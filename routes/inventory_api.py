import mysql.connector
import datetime
from flask import Blueprint, jsonify, request
from db import get_db_connection
from config import GEMINI_API_KEY
import google.generativeai as genai
from typing import List, Dict, Any

genai.configure(api_key=GEMINI_API_KEY)

# =================================================================
# ✨ 중앙 헬퍼 함수 (Helper Functions)
# =================================================================
def get_status_by_days_left(days_left, current_stock): # 🚨 current_stock 인자 추가
    """예상 소진일(days_left)과 현재 재고량(current_stock)을 입력받아 
       '재고 없음', '위험', '경고', '충분' 상태를 반환합니다."""
    
    if current_stock <= 0: # 🚨 재고가 0이하면 무조건 '재고 없음'으로 처리
        return '위험' 
        
    if days_left is None:
        # 재고는 있지만(current_stock > 0) ADU가 0이라 소진일 계산 불가한 경우
        return '충분' 
    
    if days_left <= 3:
        return '위험'
    elif days_left <= 7:
        return '경고'
    else:
        return '충분'

# =================================================================
# ✨ 중앙 헬퍼 함수 (Helper Functions)
# =================================================================

# ... (get_status_by_days_left 함수는 그대로 유지) ...

def _get_full_inventory_status(conn) -> List[Dict[str, Any]]:
    """
    [헬퍼] 모든 품목의 상세 재고 상태(ADU, 예상 소진일 포함)를 계산하여 반환합니다.
    이 함수가 재고 상태 계산의 유일한 소스 역할을 합니다 (Single Source of Truth).
    """
    cursor = conn.cursor(dictionary=True)
    sql_query = """
    WITH DailyUsage AS (
        SELECT
            item_id,
            SUM(ABS(ea_qty)) / 90 AS adu
        FROM transactions
        WHERE transaction_type IN ('출고', '폐기') AND transaction_date >= DATE_SUB(NOW(), INTERVAL 90 DAY)
        GROUP BY item_id
    )
    SELECT
        i.item_id, i.item_name, i.category, i.current_stock_ea,
        IFNULL(du.adu, 0) AS adu
    FROM items i
    LEFT JOIN DailyUsage du ON i.item_id = du.item_id
    ORDER BY i.item_name ASC;
    """
    cursor.execute(sql_query)
    items = cursor.fetchall()
    cursor.close()

    inventory_status_list = []
    for item in items:
        adu = item['adu']
        current_stock = item['current_stock_ea']
        
        # 🚨 수정: ADU가 0인 경우 days_left를 None으로 설정
        days_left = current_stock / adu if adu and adu > 0 else None
        
        status = get_status_by_days_left(days_left, current_stock)
        
        inventory_status_list.append({
            "item_id": item['item_id'],
            "item_name": item['item_name'],
            "category": item['category'],
            "current_stock_ea": int(current_stock),
            "adu": round(adu, 2) if adu is not None else 0,
            "days_left": round(days_left, 1) if days_left is not None else None,
            "status": status
        })
    return inventory_status_list


def _get_nearing_expiry_batches(conn, threshold_days: int) -> List[Dict[str, Any]]:
    """
    [헬퍼] 지정된 기간 내에 유통기한이 만료되는 모든 '배치' 목록을 반환합니다.
    """
    cursor = conn.cursor(dictionary=True)
    expiry_sql = """
        SELECT
            i.item_id, i.item_name, b.batch_id, b.expiry_date, b.current_batch_ea
        FROM inventory_batches b
        JOIN items i ON b.item_id = i.item_id
        WHERE b.expiry_date BETWEEN CURDATE() AND DATE_ADD(CURDATE(), INTERVAL %s DAY)
        AND b.current_batch_ea > 0
        ORDER BY b.expiry_date ASC, i.item_name ASC;
    """
    cursor.execute(expiry_sql, (threshold_days,))
    expiry_details = cursor.fetchall()
    cursor.close()

    for item in expiry_details:
        if isinstance(item.get('expiry_date'), datetime.date):
            item['expiry_date'] = item['expiry_date'].strftime('%Y-%m-%d')
    return expiry_details

# ... (기존 _get_nearing_expiry_batches 함수 정의 아래에 추가) ...

def _get_nearest_expiry(conn, item_id: str) -> str | None:
    """
    [헬퍼] 단일 품목의 가장 빠른 유통기한을 조회합니다.
    """
    cursor = conn.cursor(dictionary=True)
    try:
        cursor.execute("SELECT MIN(expiry_date) as nearest_expiry FROM inventory_batches WHERE item_id = %s AND current_batch_ea > 0;", (item_id,))
        result = cursor.fetchone()
        
        if result and result['nearest_expiry']:
            return result['nearest_expiry'].strftime('%Y-%m-%d')
        return None
    except Exception:
        return None
    finally:
        cursor.close()


# =================================================================
# 🏥 API 엔드포인트 (Endpoints)
# =================================================================

inventory_api = Blueprint('inventory_api', __name__)

@inventory_api.route('/inventory/status', methods=['GET'])
def get_inventory_status_list():
    """
    [수정] 모든 품목의 현재 재고 상태 목록을 중앙 헬퍼 함수를 통해 반환합니다.
    """
    conn = get_db_connection()
    if not conn:
        return jsonify({"message": "Database connection error"}), 500
    try:
        status_list = _get_full_inventory_status(conn)
        return jsonify(status_list)
    except Exception as e:
        return jsonify({"message": f"재고 현황 조회 중 오류 발생: {str(e)}"}), 500
    finally:
        if conn and conn.is_connected():
            conn.close()

@inventory_api.route('/alerts/summary', methods=['GET'])
def get_alerts_summary():
    """
    [수정] 재고 부족 및 유통기한 임박 품목의 '개수'를 중앙 헬퍼 함수를 통해 요약하여 반환합니다.
    """
    conn = get_db_connection()
    if not conn:
        return jsonify({"message": "Database connection error"}), 500
    
    try:
        # 1. 재고 부족 품목 개수 계산
        full_status = _get_full_inventory_status(conn)
        low_stock_count = sum(1 for item in full_status if item['status'] in ['위험', '경고'])

        # 2. 유통기한 임박 품목 개수 계산
        expiry_batches = _get_nearing_expiry_batches(conn, 30)
        nearing_expiry_count = len(set(item['item_id'] for item in expiry_batches)) # 품목 ID 기준 중복 제거

        return jsonify({
            "low_stock_item_count": low_stock_count,
            "nearing_expiry_item_count": nearing_expiry_count
        })
    except Exception as e:
        return jsonify({"message": f"알림 요약 정보를 가져오는 중 오류가 발생했습니다: {str(e)}"}), 500
    finally:
        if conn and conn.is_connected():
            conn.close()


@inventory_api.route('/alerts/details', methods=['GET'])
def get_alerts_details():
    conn = get_db_connection()
    if not conn:
        return jsonify({"message": "Database connection error"}), 500

    try:
        # 1. 전체 재고 상태 조회 및 딕셔너리 생성
        full_status = _get_full_inventory_status(conn)
        status_lookup = {item['item_id']: item for item in full_status}

        # 2. 상세 재고 부족 목록 (low_stock_alert_details)
        low_stock_details = []
        for item in full_status:
            if item['status'] in ['위험', '경고']:
                
                # nearest_expiry_date 추가
                nearest_expiry = _get_nearest_expiry(conn, item['item_id'])
                
                # 🚨 days_left 이상치 처리 로직 제거 (원래 값 그대로 사용)
                days_left_value = item['days_left']
                
                low_stock_details.append({
                    "item_id": item['item_id'],
                    "item_name": item['item_name'],
                    "current_stock_ea": item['current_stock_ea'],
                    "days_left": days_left_value,
                    "status": item['status'],
                    "nearest_expiry_date": nearest_expiry # 👈 유통기한 정보 추가
                })
        low_stock_details.sort(key=lambda x: (x['status'] == '경고', x['days_left'] if x['days_left'] is not None else float('inf')))

        # 3. 상세 유통기한 임박 목록 (expiry_alert_details)
        expiry_details_raw = _get_nearing_expiry_batches(conn, 30)
        
        expiry_alert_details = []
        for batch_detail in expiry_details_raw:
            item_id = batch_detail['item_id']
            if item_id in status_lookup:
                stock_info = status_lookup[item_id]
                
                # 🚨 days_left 이상치 처리 로직 제거 (원래 값 그대로 사용)
                days_left_value = stock_info['days_left']
                
                # 유통기한 정보에 품목명, 총 재고, 예상 소진일, 배치 유통기한을 포함
                expiry_alert_details.append({
                    "item_id": item['item_id'],
                    "item_name": batch_detail['item_name'],
                    "batch_id": batch_detail['batch_id'],
                    "batch_stock_ea": batch_detail['current_batch_ea'],
                    "expiry_date": batch_detail['expiry_date'],
                    "current_total_stock_ea": stock_info['current_stock_ea'],
                    "days_left": days_left_value, # 👈 조정 로직 없이 원래 days_left 값 사용
                    "status": stock_info['status']
                })

        return jsonify({
            "expiry_alert_details": expiry_alert_details,
            "low_stock_alert_details": low_stock_details
        })
    except Exception as e:
        return jsonify({"message": f"상세 알림 조회 중 오류가 발생했습니다: {str(e)}"}), 500
    finally:
        if conn and conn.is_connected():
            conn.close()


@inventory_api.route('/reports/summary-json', methods=['GET'])
def get_report_summary_json():
    """
    [수정] 핵심 지표를 중앙 헬퍼 함수 등을 통해 일관된 방식으로 계산합니다.
    """
    conn = get_db_connection()
    if not conn:
        return jsonify({"message": "Database connection error"}), 500
    
    cursor = conn.cursor(dictionary=True)
    try:
        # 1. 총 사용량 (지난 30일)
        cursor.execute("""
            SELECT SUM(ABS(ea_qty)) as total_usage FROM transactions
            WHERE transaction_type IN ('출고', '폐기') 
            AND transaction_date >= DATE_SUB(NOW(), INTERVAL 30 DAY);
        """)
        total_usage = (cursor.fetchone()['total_usage'] or 0)

        # 2. 헬퍼 함수를 통해 재고 부족 및 유통기한 임박 품목 개수 가져오기
        full_status = _get_full_inventory_status(conn)
        low_stock_count = sum(1 for item in full_status if item['status'] == '위험')
        total_items = len(full_status)
        
        expiry_batches = _get_nearing_expiry_batches(conn, 30)
        nearing_expiry_count = len(set(item['item_id'] for item in expiry_batches))

        # 3. 재고 건전성 점수 계산
        healthy_items = total_items - low_stock_count
        health_score = round((healthy_items / total_items) * 100, 1) if total_items > 0 else 100

        return jsonify({
            "total_usage_last_month": int(total_usage),
            "nearing_expiry_item_count": nearing_expiry_count,
            "low_stock_item_count": low_stock_count,
            "inventory_health_score": health_score
        })
    except Exception as e:
        return jsonify({"message": f"요약 리포트 생성 중 오류가 발생했습니다: {str(e)}"}), 500
    finally:
        cursor.close()
        if conn and conn.is_connected():
            conn.close()


@inventory_api.route('/items/<item_id>/stock-history', methods=['GET'])
def get_stock_history(item_id):
    # 이 함수는 특정 item_id에만 국한되므로 독립적으로 유지
    conn = get_db_connection()
    if not conn: return jsonify({"message": "Database connection error"}), 500
    cursor = conn.cursor(dictionary=True)
    try:
        sql_query = "SELECT transaction_date, ea_qty, SUM(ea_qty) OVER (ORDER BY transaction_date ASC) AS cumulative_stock FROM transactions WHERE item_id = %s ORDER BY transaction_date ASC;"
        cursor.execute(sql_query, (item_id,))
        results = cursor.fetchall()
        if not results: return jsonify({"item_id": item_id, "message": "No transaction history found", "data": []}), 404
        data = [{"date": r['transaction_date'].strftime('%Y-%m-%d %H:%M:%S'), "ea_qty": int(r['ea_qty']), "cumulative_stock": int(r['cumulative_stock'])} for r in results]
        return jsonify({"item_id": item_id, "data": data})
    except Exception as e:
        return jsonify({"message": f"Database query failed: {str(e)}"}), 500
    finally:
        cursor.close()
        conn.close()

@inventory_api.route('/items/<item_id>/details', methods=['GET'])
def get_item_details(item_id):
    conn = get_db_connection()
    if not conn: return jsonify({"message": "Database connection error"}), 500
    cursor = conn.cursor(dictionary=True)
    try:
        # 1. 기본 정보 조회
        cursor.execute("SELECT item_name, current_stock_ea, category FROM items WHERE item_id = %s;", (item_id,))
        item_base_info = cursor.fetchone()
        if not item_base_info: return jsonify({"message": f"Item with ID {item_id} not found."}), 404
        
        current_stock = item_base_info['current_stock_ea'] # 재고량 변수 저장

        # 2. ADU (단일 품목에 대한 쿼리 실행)
        cursor.execute("SELECT SUM(ABS(ea_qty)) / 90 AS adu FROM transactions WHERE item_id = %s AND transaction_type IN ('출고', '폐기') AND transaction_date >= DATE_SUB(NOW(), INTERVAL 90 DAY);", (item_id,))
        
        adu_result = cursor.fetchone()
        
        adu = adu_result.get('adu') if adu_result else 0
        adu = adu if adu is not None else 0
        
        predicted_demand = round(adu * 30)

        # 🚨 수정: ADU가 0인 경우 days_left를 None으로 설정
        days_left = current_stock / adu if adu and adu > 0 else None
        
        # 💡 get_status_by_days_left 함수를 명확하게 호출하여 status 설정
        status = get_status_by_days_left(days_left, current_stock)
        
        # 3. 가장 빠른 유통기한
        cursor.execute("SELECT MIN(expiry_date) as nearest_expiry FROM inventory_batches WHERE item_id = %s AND current_batch_ea > 0;", (item_id,))
        nearest_expiry_result = cursor.fetchone()
        
        nearest_expiry_date = nearest_expiry_result['nearest_expiry'].strftime('%Y-%m-%d') if nearest_expiry_result and nearest_expiry_result['nearest_expiry'] else None
        
        response_data = {
            "item_id": item_id, 
            "item_name": item_base_info['item_name'], 
            "category": item_base_info['category'],
            "current_stock": int(current_stock), 
            "next_month_predicted_demand": int(predicted_demand),
            "nearest_expiry_date": nearest_expiry_date,
            "status": status,
            "adu": round(adu, 2) if adu is not None else 0,
            # 🚨 days_left가 None이면 JSON에서 null로 반환됨
            "days_left": round(days_left, 1) if days_left is not None else None
        }
        return jsonify(response_data)
        
    except Exception as e:
        return jsonify({"message": f"Database query failed: {str(e)}"}), 500
    finally:
        cursor.close()
        conn.close()

@inventory_api.route('/items/<item_id>/usage/5y', methods=['GET'])
def get_item_usage_5y(item_id):
    conn = get_db_connection()
    if not conn: return jsonify({"message": "Database connection error"}), 500
    cursor = conn.cursor(dictionary=True)
    try:
        # 🚨 5년 사용량 추이: DATE_FORMAT 대신 YEAR() 사용 (연도 정수 반환)
        cursor.execute("SELECT YEAR(transaction_date) AS year, SUM(ABS(ea_qty)) AS total_usage FROM transactions WHERE item_id = %s AND transaction_type IN ('출고', '폐기') AND transaction_date >= DATE_SUB(NOW(), INTERVAL 5 YEAR) GROUP BY year ORDER BY year ASC;", (item_id,))
        usage_trend_5y = cursor.fetchall()

        response_data = {
            "item_id": item_id,
            "usage_trend_5y": [
                # YEAR()는 정수를 반환하므로 str()로 변환하여 응답
                {"year": str(r['year']), "usage": int(r['total_usage'])} 
                for r in usage_trend_5y
            ]
        }
        return jsonify(response_data)
        
    except Exception as e:
        return jsonify({"message": f"Database query failed: {str(e)}"}), 500
    finally:
        cursor.close()
        conn.close()

@inventory_api.route('/items/<item_id>/usage/1y', methods=['GET'])
def get_item_usage_1y(item_id):
    conn = get_db_connection()
    if not conn: return jsonify({"message": "Database connection error"}), 500
    cursor = conn.cursor(dictionary=True)
    try:
        # 🚨 최종 수정 쿼리: CONCAT, YEAR, LPAD를 사용하여 DB에서 'YYYY-MM' 문자열 직접 생성
        sql_query = """
            SELECT 
                CONCAT(YEAR(transaction_date), '-', LPAD(MONTH(transaction_date), 2, '0')) AS month, 
                SUM(ABS(ea_qty)) AS total_usage 
            FROM transactions 
            WHERE 
                item_id = %s 
                AND transaction_type IN ('출고', '폐기') 
                AND transaction_date >= DATE_SUB(NOW(), INTERVAL 12 MONTH) 
            GROUP BY month 
            ORDER BY month ASC;
        """
        cursor.execute(sql_query, (item_id,))
        monthly_pattern_1y = cursor.fetchall()
        
        response_data = {
            "item_id": item_id,
            "monthly_usage_pattern_1y": [
                # month 필드는 이미 'YYYY-MM' 문자열이므로, 안전하게 str()로만 변환
                {"month": str(r['month']), "usage": int(r['total_usage'])} 
                for r in monthly_pattern_1y
            ]
        }
        return jsonify(response_data)
        
    except Exception as e:
        return jsonify({"message": f"Database query failed: {str(e)}"}), 500
    finally:
        cursor.close()
        conn.close()


@inventory_api.route('/inventory/in', methods=['POST'])
def record_inbound():
    """
    재고 입고를 처리하고, 처리 후 해당 품목의 최신 재고 상태를 반환합니다.
    """
    data = request.get_json()
    item_id = data.get('item_id')
    in_box_qty = data.get('in_box_qty')
    expiry_date_str = data.get('expiry_date')

    if not all([item_id, in_box_qty, expiry_date_str]):
        return jsonify({"message": "필수 필드가 누락되었습니다."}), 400

    conn = get_db_connection()
    if not conn:
        return jsonify({"message": "데이터베이스 연결 오류"}), 500
    
    cursor = conn.cursor(dictionary=True)
    
    try:
        conn.start_transaction()

        cursor.execute("SELECT ea_per_box FROM items WHERE item_id = %s", (item_id,))
        result = cursor.fetchone()
        if not result:
            conn.rollback()
            return jsonify({"message": f"품목 ID {item_id}를 찾을 수 없습니다."}), 404
        
        ea_per_box = result['ea_per_box']
        ea_qty = int(in_box_qty) * ea_per_box
        transaction_date = datetime.datetime.now()
        
        sql_batch = "INSERT INTO inventory_batches (item_id, expiry_date, in_date, current_batch_ea) VALUES (%s, %s, %s, %s)"
        cursor.execute(sql_batch, (item_id, expiry_date_str, transaction_date, ea_qty))
        new_batch_id = cursor.lastrowid

        sql_items = "UPDATE items SET current_stock_ea = current_stock_ea + %s WHERE item_id = %s"
        cursor.execute(sql_items, (ea_qty, item_id))

        sql_trans = "INSERT INTO transactions (transaction_date, transaction_type, item_id, batch_id, ea_qty, in_box_qty, out_ea_qty) VALUES (%s, '입고', %s, %s, %s, %s, NULL)"
        cursor.execute(sql_trans, (transaction_date, item_id, new_batch_id, ea_qty, in_box_qty))
        transaction_id = cursor.lastrowid
        
        conn.commit()
        
        status_query = """
            WITH DailyUsage AS (
                SELECT SUM(ABS(ea_qty)) / 90 AS adu FROM transactions
                WHERE item_id = %s AND transaction_type = '출고' AND transaction_date >= DATE_SUB(NOW(), INTERVAL 90 DAY)
            )
            SELECT i.current_stock_ea, IFNULL(du.adu, 0) AS adu
            FROM items i, DailyUsage du
            WHERE i.item_id = %s;
        """
        cursor.execute(status_query, (item_id, item_id))
        status_data = cursor.fetchone()
        
        days_left = None
        if status_data and status_data['adu'] > 0:
            days_left = status_data['current_stock_ea'] / status_data['adu']
        
        updated_status = get_status_by_days_left(days_left)

        return jsonify({
            "message": "입고가 성공적으로 기록되었습니다.",
            "transaction_id": transaction_id,
            "ea_added": ea_qty,
            "batch_id": new_batch_id,
            "updated_status": updated_status
        }), 201

    except mysql.connector.Error as err:
        conn.rollback()
        print(f"데이터베이스 오류: {err}")
        return jsonify({"message": f"트랜잭션 실패: {err.msg}"}), 500
    finally:
        cursor.close()
        conn.close()


@inventory_api.route('/inventory/out', methods=['POST'])
def record_outbound():
    """
    재고 출고를 처리하고, 처리 후 해당 품목의 최신 재고 상태를 반환합니다.
    """
    data = request.get_json()
    item_id = data.get('item_id')
    out_ea_qty = data.get('out_ea_qty')

    if not all([item_id, out_ea_qty]):
        return jsonify({"message": "필수 필드가 누락되었습니다."}), 400

    conn = get_db_connection()
    if not conn:
        return jsonify({"message": "데이터베이스 연결 오류"}), 500
    
    cursor = conn.cursor(dictionary=True)
    
    try:
        cursor.callproc("perform_fifo_shipment", (item_id, int(out_ea_qty)))
        conn.commit()

        status_query = """
            WITH DailyUsage AS (
                SELECT SUM(ABS(ea_qty)) / 90 AS adu FROM transactions
                WHERE item_id = %s AND transaction_type = '출고' AND transaction_date >= DATE_SUB(NOW(), INTERVAL 90 DAY)
            )
            SELECT i.current_stock_ea, IFNULL(du.adu, 0) AS adu
            FROM items i, DailyUsage du
            WHERE i.item_id = %s;
        """
        cursor.execute(status_query, (item_id, item_id))
        status_data = cursor.fetchone()
        
        days_left = None
        if status_data and status_data['adu'] > 0:
            days_left = status_data['current_stock_ea'] / status_data['adu']
        
        updated_status = get_status_by_days_left(days_left)

        return jsonify({
            "message": "출고가 성공적으로 기록되었습니다. (FIFO 적용)",
            "item_id": item_id,
            "ea_used": int(out_ea_qty),
            "updated_status": updated_status
        }), 200

    except mysql.connector.Error as err:
        conn.rollback()
        error_message = str(err).split(':')[-1].strip()
        
        if "재고가 부족하여" in error_message:
             return jsonify({"message": f"트랜잭션 실패: {error_message}"}), 409
             
        print(f"데이터베이스 오류: {err}")
        return jsonify({"message": f"트랜잭션 실패: {err.msg}"}), 500
    finally:
        cursor.close()
        conn.close()

@inventory_api.route('/reports/monthly-io-summary', methods=['GET'])
def get_monthly_io_summary_graph():
    # 독립적인 그래프용 API이므로 유지
    conn = get_db_connection()
    if not conn: return jsonify({"message": "Database connection error"}), 500
    cursor = conn.cursor(dictionary=True)
    try:
        # SQL 쿼리: CONCAT 함수를 사용하여 'YYYY-MM-DD' 문자열을 DB에서 직접 생성하여 안정성을 높입니다.
        # 이 쿼리는 transaction_date의 시간 부분을 무시하고 날짜별로 그룹화합니다.
        sql_query = """
            SELECT 
                CONCAT(YEAR(transaction_date), '-', LPAD(MONTH(transaction_date), 2, '0'), '-', LPAD(DAY(transaction_date), 2, '0')) AS date,
                SUM(CASE WHEN transaction_type = '입고' THEN ea_qty ELSE 0 END) as inbound, 
                SUM(CASE WHEN transaction_type = '출고' THEN ABS(ea_qty) ELSE 0 END) as outbound, 
                SUM(CASE WHEN transaction_type = '폐기' THEN ABS(ea_qty) ELSE 0 END) as disposal 
            FROM transactions 
            WHERE transaction_date >= DATE_SUB(NOW(), INTERVAL 30 DAY) 
            GROUP BY 1  -- 컬럼 인덱스(첫 번째 SELECT 컬럼)를 사용해 그룹화를 강제
            ORDER BY date ASC;
        """
        cursor.execute(sql_query)
        graph_data = cursor.fetchall()
        
        for row in graph_data:
            # DB가 문자열을 반환하므로, str()로만 변환하고 포맷팅 로직은 제거합니다.
            row['date'] = str(row['date']) 
            row['inbound'] = int(row['inbound'])
            row['outbound'] = int(row['outbound'])
            row['disposal'] = int(row['disposal'])
        
        return jsonify(graph_data)
        
    except Exception as e:
        return jsonify({"message": f"그래프 데이터 조회 중 오류 발생: {str(e)}"}), 500
    finally:
        if conn and conn.is_connected():
            cursor.close()
            conn.close()

@inventory_api.route('/reports/detailed-monthly', methods=['GET'])
def get_detailed_monthly_report():
    """
    [수정] AI 리포트 생성 시, 중앙 헬퍼 함수를 통해 일관된 데이터를 사용합니다.
    """
    conn = get_db_connection()
    if not conn:
        return jsonify({"message": "Database connection error"}), 500
    
    cursor = conn.cursor(dictionary=True)
    try:
        # 1. 내부 데이터 집계 (헬퍼 함수 사용)
        full_status = _get_full_inventory_status(conn)
        # 재고 없음(current_stock <= 0)도 '위험'으로 분류되도록, status 로직 수정 반영
        low_stock_alerts_for_report = [
            {"item_name": item['item_name'], "current_stock": item['current_stock_ea'], "days_left": item['days_left']}
            for item in full_status if item['status'] in ['위험', '경고']
        ]
        
        expiry_alerts_for_report = _get_nearing_expiry_batches(conn, 30)

        cursor.execute("""
            SELECT item_name, SUM(ABS(ea_qty)) as qty FROM transactions t
            JOIN items i ON t.item_id = i.item_id
            WHERE t.transaction_type IN ('출고', '폐기') AND t.transaction_date >= DATE_SUB(NOW(), INTERVAL 30 DAY)
            GROUP BY item_name ORDER BY qty DESC LIMIT 3;
        """)
        top_consumed_items = cursor.fetchall()

        # 2. 외부 데이터 및 컨텍스트 정보
        current_month = datetime.datetime.now().month
        seasons = {3: "봄 (환절기)", 4: "봄 (환절기)", 5: "봄 (환절기)", 6: "여름", 7: "여름", 8: "여름", 9: "가을 (환절기)", 10: "가을 (환절기)", 11: "가을 (환절기)", 12: "겨울", 1: "겨울", 2: "겨울"}
        current_season = seasons.get(current_month)

        # 3. 강화된 프롬프트 엔지니어링 (HTML 포맷팅 요청 추가)
        prompt = f"""
        당신은 대한민국 소재 동네 이비인후과의 재고 관리를 돕는 AI 컨설턴트입니다.
        아래 제공된 병원의 내부 재고 데이터를 분석하여 원장님을 위한 상세 분석 리포트를 작성해주세요.

        **[분석 대상 데이터]**
        1.  **병원 내부 데이터 (최근 30일):**
            - 최다 소모 품목 Top 3: {top_consumed_items}
            - 현재 재고 부족 알림 (7일 내 소진 예상): {low_stock_alerts_for_report}
            - 현재 유통기한 임박 알림 (30일 내 만료): {expiry_alerts_for_report}
        2.  **외부 보건 동향:**
            - 현재 계절: {current_season}

        **[리포트 작성 가이드]**
        * **응답 형식:** 프론트엔드에서 가독성이 좋도록 반환해야 합니다. 시각적으로 전문적이고 깔끔하게 디자인되어야 합니다.
        * **제목:** 월간 AI 재고 분석 리포트
        * **분석 기간:** 분석 기간: 최근 30일 ({datetime.date.today().strftime('%Y-%m-%d')} 기준)\
        * **1. 총평:** 재고 관리 성과와 현재 상황을 굵은 글씨로 요약.
        * **2. 외부 환경 분석 및 예측:** '현재 계절'을 기반으로 수요 급증 예상 품목 언급.
        * **3. 내부 데이터 심층 분석:** '최다 소모 품목', '재고 부족', '유통기한 임박' 문제 해결을 위한 구체적 조치 제안.
        * **4. 최종 권장 조치 (Action Items):** 즉시 발주해야 할 품목 목록과 이유를 명확하게 제시.
        
        - 전문가적이고 신뢰감 있는 어조로, 데이터를 근거로 명확하고 이해하기 쉽게 작성해주세요.
        """

        model = genai.GenerativeModel('gemini-2.5-flash')
        response = model.generate_content(prompt)
        
        return jsonify({"report_text": response.text})
    except Exception as e:
        return jsonify({"message": f"AI 리포트 생성 중 오류가 발생했습니다: {str(e)}"}), 500
    finally:
        if conn and conn.is_connected():
            cursor.close()
            conn.close()

@inventory_api.route('/reports/high-disposal-items', methods=['GET'])
def get_high_disposal_report():
    """
    폐기율이 높은 상위 3개 품목의 재고회전율 및 폐기율을 반환합니다.
    (기간: 최근 90일)
    """
    conn = get_db_connection()
    if not conn:
        return jsonify({"message": "Database connection error"}), 500
    cursor = conn.cursor(dictionary=True)
    
    try:
        # 🚨 SQL 쿼리: LIMIT을 5에서 3으로 변경
        sql_query = """
        WITH ItemUsage AS (
            SELECT
                t.item_id,
                SUM(CASE WHEN t.transaction_type = '폐기' THEN ABS(t.ea_qty) ELSE 0 END) AS total_disposal_qty,
                SUM(ABS(t.ea_qty)) AS total_usage_and_disposal
            FROM transactions t
            WHERE t.transaction_type IN ('출고', '폐기')
              AND t.transaction_date >= DATE_SUB(NOW(), INTERVAL 90 DAY)
            GROUP BY t.item_id
        )
        SELECT
            i.item_id,
            i.item_name,
            i.current_stock_ea,
            iu.total_disposal_qty,
            iu.total_usage_and_disposal,
            (iu.total_disposal_qty / NULLIF(iu.total_usage_and_disposal, 0)) AS disposal_rate -- 0으로 나누는 것 방지
        FROM items i
        JOIN ItemUsage iu ON i.item_id = iu.item_id
        HAVING iu.total_usage_and_disposal > 0 -- 사용 기록이 있는 품목만
        ORDER BY disposal_rate DESC, total_disposal_qty DESC
        LIMIT 3; 
        """
        
        cursor.execute(sql_query)
        report_data_raw = cursor.fetchall()
        
        report_results = []
        for row in report_data_raw:
            # 폐기율 (Disposal Rate)
            disposal_rate = row['disposal_rate']
            
            # 재고회전율 (Turnover Rate): (90일 총 사용량) / 현재 재고
            current_stock = row['current_stock_ea']
            total_activity = row['total_usage_and_disposal']
            
            inventory_turnover = None
            if current_stock > 0:
                # 90일 회전율을 연간으로 환산하여 표시 (90일 * 4 = 1년)
                turnover = (total_activity / current_stock) * 4 
                inventory_turnover = round(turnover, 2)
            
            report_results.append({
                "item_id": row['item_id'],
                "item_name": row['item_name'],
                "disposal_rate": round(disposal_rate * 100, 2), # %로 표시
                "inventory_turnover_rate": inventory_turnover,
                "current_stock_ea": int(current_stock),
                "total_disposal_qty": int(row['total_disposal_qty'])
            })

        return jsonify(report_results)
        
    except Exception as e:
        return jsonify({"message": f"리포트 조회 중 오류 발생: {str(e)}"}), 500
    finally:
        cursor.close()
        if conn and conn.is_connected():
            conn.close()