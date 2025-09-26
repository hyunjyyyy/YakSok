import mysql.connector
import datetime
from flask import Blueprint, jsonify, request
from db import get_db_connection

# Blueprint 인스턴스 생성
inventory_api = Blueprint('inventory_api', __name__)

@inventory_api.route('/items/<item_id>/usage', methods=['GET'])
def get_monthly_usage_data(item_id):
    """
    특정 품목의 최근 12개월간 월별 사용량(출고량) 데이터를 반환합니다.
    URL 예시: /api/items/MED-SYR-001/usage
    """
    conn = get_db_connection()
    if not conn:
        return jsonify({"message": "Database connection error"}), 500
    
    cursor = conn.cursor(dictionary=True)

    try:
        sql_query = """
        SELECT
            DATE_FORMAT(transaction_date, '%%Y-%%m') AS month_label,
            SUM(ABS(ea_qty)) AS total_usage_ea
        FROM
            transactions
        WHERE
            item_id = %s
            AND transaction_type = '출고'
            AND transaction_date >= DATE_SUB(NOW(), INTERVAL 12 MONTH)
        GROUP BY
            month_label
        ORDER BY
            month_label ASC;
        """
        
        cursor.execute(sql_query, (item_id,))
        results = cursor.fetchall()
        
        if not results:
            return jsonify({
                "item_id": item_id,
                "message": "No usage data found for the last 12 months.",
                "data": []
            }), 404

        data = [
            {"month": row['month_label'], "usage_ea": int(row['total_usage_ea'])}
            for row in results
        ]

        return jsonify({"item_id": item_id, "data": data})

    except mysql.connector.Error as err:
        print(f"SQL Error during usage query: {err}")
        return jsonify({"message": f"Database query failed: {err.msg}"}), 500
    finally:
        cursor.close()
        conn.close()


@inventory_api.route('/items/<item_id>/stock-history', methods=['GET'])
def get_stock_history(item_id):
    """
    특정 품목의 재고 변동량 데이터를 반환합니다.
    URL 예시: /api/items/MED-SYR-001/stock-history
    """
    conn = get_db_connection()
    if not conn:
        return jsonify({"message": "Database connection error"}), 500

    cursor = conn.cursor(dictionary=True)

    try:
        # SQL: 모든 입출고 기록과 ea_qty를 가져와 누적 재고량을 계산
        sql_query = """
        SELECT
            transaction_date,
            ea_qty,
            SUM(ea_qty) OVER (ORDER BY transaction_date ASC) AS cumulative_stock
        FROM
            transactions
        WHERE
            item_id = %s
        ORDER BY
            transaction_date ASC;
        """
        
        cursor.execute(sql_query, (item_id,))
        results = cursor.fetchall()

        if not results:
            return jsonify({
                "item_id": item_id,
                "message": "No transaction history found.",
                "data": []
            }), 404

        data = [
            {
                "date": row['transaction_date'].strftime('%Y-%m-%d %H:%M:%S'),
                "ea_qty": int(row['ea_qty']),
                "cumulative_stock": int(row['cumulative_stock'])
            }
            for row in results
        ]

        return jsonify({"item_id": item_id, "data": data})

    except mysql.connector.Error as err:
        print(f"SQL Error during stock history query: {err}")
        return jsonify({"message": f"Database query failed: {err.msg}"}), 500
    finally:
        cursor.close()
        conn.close()


@inventory_api.route('/inventory/in', methods=['POST'])
def record_inbound():
    """
    재고 입고를 처리하는 엔드포인트입니다.
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
    
    cursor = conn.cursor()
    
    try:
        conn.start_transaction()

        # 1. items 테이블에서 ea_per_box 조회
        cursor.execute("SELECT ea_per_box FROM items WHERE item_id = %s", (item_id,))
        result = cursor.fetchone()
        if not result:
            conn.close()
            return jsonify({"message": f"품목 ID {item_id}를 찾을 수 없습니다."}), 404
        
        ea_per_box = result[0]
        ea_qty = int(in_box_qty) * ea_per_box
        transaction_date = datetime.datetime.now()
        
        # 2. inventory_batches에 새로운 배치 추가
        sql_batch = """
        INSERT INTO inventory_batches (item_id, expiry_date, in_date, current_batch_ea)
        VALUES (%s, %s, %s, %s)
        """
        cursor.execute(sql_batch, (item_id, expiry_date_str, transaction_date, ea_qty))
        new_batch_id = cursor.lastrowid

        # 3. items 테이블의 총 재고 업데이트
        sql_items = "UPDATE items SET current_stock_ea = current_stock_ea + %s WHERE item_id = %s"
        cursor.execute(sql_items, (ea_qty, item_id))

        # 4. transactions 테이블에 최종 기록 (out_ea_qty에 NULL 명시)
        sql_trans = """
        INSERT INTO transactions (transaction_date, transaction_type, item_id, batch_id, ea_qty, in_box_qty, out_ea_qty)
        VALUES (%s, '입고', %s, %s, %s, %s, NULL)
        """
        cursor.execute(sql_trans, (transaction_date, item_id, new_batch_id, ea_qty, in_box_qty))

        conn.commit()
        return jsonify({
            "message": "입고가 성공적으로 기록되었습니다.",
            "transaction_id": cursor.lastrowid,
            "ea_added": ea_qty,
            "batch_id": new_batch_id
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
    재고 출고를 처리하는 엔드포인트입니다.
    """
    data = request.get_json()
    item_id = data.get('item_id')
    out_ea_qty = data.get('out_ea_qty')

    if not all([item_id, out_ea_qty]):
        return jsonify({"message": "필수 필드가 누락되었습니다."}), 400

    conn = get_db_connection()
    if not conn:
        return jsonify({"message": "데이터베이스 연결 오류"}), 500
    
    cursor = conn.cursor()
    
    try:
        # 저장 프로시저를 호출하여 FIFO 로직을 실행
        cursor.callproc("perform_fifo_shipment", (item_id, int(out_ea_qty)))
        conn.commit()

        return jsonify({
            "message": "출고가 성공적으로 기록되었습니다. (FIFO 적용)",
            "item_id": item_id,
            "ea_used": int(out_ea_qty)
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



@inventory_api.route('/alerts/summary', methods=['GET'])
def get_alerts_summary():
    """
    재고 부족 또는 유통기한 임박 품목에 대한 요약 정보를 반환합니다.
    """
    conn = get_db_connection()
    if not conn:
        return jsonify({"message": "Database connection error"}), 500
    
    cursor = conn.cursor(dictionary=True)
    
    # 알림 기준일 설정
    stock_threshold_days = 14  # 재고 부족 기준일
    expiry_threshold_days = 30 # 유통기한 임박 기준일

    try:
        # 1. 재고 부족 알림 (ADU 기반)
        # 90일간의 데이터를 기반으로 ADU(평균 일일 사용량) 계산
        sql_low_stock = """
        WITH DailyUsage AS (
            SELECT
                item_id,
                SUM(ABS(ea_qty)) / 90 AS adu
            FROM transactions
            WHERE transaction_type = '출고' AND transaction_date >= DATE_SUB(NOW(), INTERVAL 90 DAY)
            GROUP BY item_id
        )
        SELECT
            i.item_id,
            i.item_name,
            i.current_stock_ea,
            du.adu,
            (i.current_stock_ea / du.adu) AS days_left
        FROM items i
        JOIN DailyUsage du ON i.item_id = du.item_id
        WHERE (i.current_stock_ea / du.adu) < %s AND i.current_stock_ea > 0;
        """
        cursor.execute(sql_low_stock, (stock_threshold_days,))
        low_stock_items = cursor.fetchall()

        # 2. 유통기한 임박 알림
        sql_nearing_expiry = """
        SELECT
            b.item_id,
            i.item_name,
            b.batch_id,
            b.expiry_date,
            b.current_batch_ea
        FROM inventory_batches b
        JOIN items i ON b.item_id = i.item_id
        WHERE b.expiry_date BETWEEN CURDATE() AND DATE_ADD(CURDATE(), INTERVAL %s DAY)
        AND b.current_batch_ea > 0
        ORDER BY b.expiry_date ASC;
        """
        cursor.execute(sql_nearing_expiry, (expiry_threshold_days,))
        nearing_expiry_items = cursor.fetchall()

        return jsonify({
            "low_stock_alert": low_stock_items,
            "expiry_alert": nearing_expiry_items
        })

    except mysql.connector.Error as err:
        print(f"SQL Error during alert summary query: {err}")
        return jsonify({"message": f"Database query failed: {err.msg}"}), 500
    finally:
        cursor.close()
        conn.close()
