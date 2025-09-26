from flask import Flask, jsonify
from flask_cors import CORS

# routes 폴더에서 각 기능별 Blueprint를 가져옵니다.
from routes.inventory_api import inventory_api
from routes.csv_analyze_api import csv_analyzer_api

def create_app():
    """
    Flask 애플리케이션을 생성하고 설정하는 'Application Factory' 함수입니다.
    """
    # 1. Flask 앱 인스턴스 생성
    app = Flask(__name__)
    
    # 2. CORS 설정
    CORS(app)

    # 3. Blueprint 등록: 기능별 API를 앱에 연결합니다.
    # 핵심 재고 관리 API
    app.register_blueprint(inventory_api, url_prefix='/api')
    # CSV 파일 분석 API
    app.register_blueprint(csv_analyzer_api, url_prefix='/csv')

    # 4. 간단한 테스트용 엔드포인트 등록
    @app.route('/', methods=['GET'])
    def hello_world():
        """기본 접속 테스트용 엔드포인트입니다."""
        return jsonify({"message": "Hello, YakSok!", "status": "Running"}), 200

    # 5. 설정이 완료된 앱 인스턴스를 반환합니다.
    return app

# 이 스크립트가 직접 실행될 때만 서버를 구동합니다.
if __name__ == '__main__':
    app = create_app()
    # 개발 환경에서는 debug=True로 설정하여 변경사항을 바로 반영합니다.
    app.run(debug=True)