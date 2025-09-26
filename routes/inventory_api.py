import mysql.connector
import datetime
from flask import Blueprint, jsonify, request
from db import get_db_connection

# 헬퍼 함수: 예상 소진일에 따라 상태를 반환
def get_status_by_days_left(days_left):
    """예상 소진일(days_left)을 입력받아 '위험', '경고', '충분' 상태를 반환합니다."""
    if days_left is None:
        return '충분' # 사용 기록이 없는 경우
    if days_left <= 3:
        return '위험'
    elif days_left <= 7:
        return '경고'
    else:
        return '충분'

# Blueprint 인스턴스 생성
inventory_api = Blueprint('inventory_api', __name__)

@inventory_api.route('/items/<item_id>/usage', methods=['GET'])
def get_monthly_usage_data(item_id):
    """
    특정 품목의 최근 12개월간 월별 사용량(출고량) 데이터를 반환합니다.
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
    """
    conn = get_db_connection()
    if not conn:
        return jsonify({"message": "Database connection error"}), 500

    cursor = conn.cursor(dictionary=True)

    try:
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


@inventory_api.route('/alerts/summary', methods=['GET'])
def get_alerts_summary():
    """
    재고 부족 또는 유통기한 임박 품목에 대한 요약 정보를 반환합니다.
    (재고 부족 품목에 'status' 필드 추가)
    """
    conn = get_db_connection()
    if not conn:
        return jsonify({"message": "Database connection error"}), 500
    
    cursor = conn.cursor(dictionary=True)
    
    stock_threshold_days = 14
    expiry_threshold_days = 30

    try:
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
        low_stock_items_raw = cursor.fetchall()

        low_stock_items = []
        for item in low_stock_items_raw:
            days_left = item['days_left']
            item['status'] = get_status_by_days_left(days_left)
            low_stock_items.append(item)

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


@inventory_api.route('/inventory/status', methods=['GET'])
def get_inventory_status_list():
    """
    모든 품목의 현재 재고량과 일평균 사용량(ADU)을 기반으로 한
    재고 상태('위험', '경고', '충분')가 포함된 전체 재고 목록을 반환합니다.
    """
    conn = get_db_connection()
    if not conn:
        return jsonify({"message": "Database connection error"}), 500
    
    cursor = conn.cursor(dictionary=True)
    
    try:
        sql_query = """
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
            i.category,
            i.current_stock_ea,
            IFNULL(du.adu, 0) AS adu
        FROM items i
        LEFT JOIN DailyUsage du ON i.item_id = du.item_id
        ORDER BY i.item_name ASC;
        """
        cursor.execute(sql_query)
        items = cursor.fetchall()

        inventory_status_list = []
        for item in items:
            adu = item['adu']
            current_stock = item['current_stock_ea']
            days_left = None
            
            if adu > 0:
                days_left = current_stock / adu
            
            status = get_status_by_days_left(days_left)
            
            item_status = {
                "item_id": item['item_id'],
                "item_name": item['item_name'],
                "category": item['category'],
                "current_stock_ea": int(current_stock),
                "adu": round(adu, 2),
                "days_left": round(days_left, 1) if days_left is not None else None,
                "status": status
            }
            inventory_status_list.append(item_status)

        return jsonify(inventory_status_list)

    except mysql.connector.Error as err:
        print(f"SQL Error during inventory status query: {err}")
        return jsonify({"message": f"Database query failed: {err.msg}"}), 500
    finally:
        cursor.close()
        conn.close()