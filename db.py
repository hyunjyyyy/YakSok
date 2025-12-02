# db.py
import mysql.connector
from mysql.connector import errorcode
from config import DB_CONFIG

def get_db_connection():
    """데이터베이스 연결 객체를 생성하고 반환합니다."""
    try:
        return mysql.connector.connect(**DB_CONFIG)
    except mysql.connector.Error as err:
        if err.errno == errorcode.ER_ACCESS_DENIED_ERROR:
            print("사용자 이름이나 비밀번호가 잘못되었습니다.")
        elif err.errno == errorcode.ER_BAD_DB_ERROR:
            print("데이터베이스가 존재하지 않습니다.")
        else:
            print(err)
        return None
