import datetime
from flask import Flask, jsonify, request

# Flask 애플리케이션 인스턴스 생성
app = Flask(__name__)

from routes.inventory_api import inventory_api
app.register_blueprint(inventory_api, url_prefix='/api')
...
@app.route('/', methods=['GET'])
def hello_world():
    """기본 접속 테스트용 엔드포인트입니다."""
    return jsonify({"message": "Hello, YakSok!", "status": "Running"}), 200

if __name__ == '__main__':
    # 개발 환경에서만 디버그 모드를 활성화하세요.
    app.run(debug=True)
