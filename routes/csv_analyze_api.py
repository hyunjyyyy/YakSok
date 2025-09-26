import pandas as pd
from flask import Blueprint, jsonify, request
import google.generativeai as genai

# --- ✨ 1. Gemini API 키 설정 추가 ---
from config import GEMINI_API_KEY
genai.configure(api_key=GEMINI_API_KEY)

# ✨ 'csv_analyzer_api'라는 새로운 이름으로 Blueprint 생성
csv_analyzer_api = Blueprint('csv_analyzer_api', __name__)

@csv_analyzer_api.route('/reports/generate-from-csv', methods=['POST'])
def generate_report_from_csv():
    """
    업로드된 CSV 파일의 데이터를 기반으로 AI 리포트와 그래프 데이터를 생성합니다.
    """
    if 'file' not in request.files:
        return jsonify({"message": "CSV 파일이 없습니다."}), 400

    file = request.files['file']
    if file.filename == '':
        return jsonify({"message": "파일이 선택되지 않았습니다."}), 400

    try:
        df = pd.read_csv(file, encoding='utf-8') # 한글 깨짐 방지

        # --- ✨ 2. 날짜 타입 변환 오류 수정 ---
        df['date'] = pd.to_datetime(df['date'])

        # --- 데이터 분석 및 요약 (CSV 컬럼명에 맞게 수정) ---
        
        # --- AI 리포트용 데이터 분석 ---
        usage_df = df[df['transaction_type'].isin(['출고', '폐기'])]
        top_items_dict = usage_df.groupby('item_name')['quantity'].sum().nlargest(3).to_dict()
        start_date = df['date'].min().strftime('%Y-%m-%d')
        end_date = df['date'].max().strftime('%Y-%m-%d')

        # --- AI 프롬프트 생성 ---
        prompt = f"""
        당신은 데이터 분석 전문가입니다. 아래의 CSV 파일 분석 결과를 바탕으로,
        이비인후과의 재고 사용 현황에 대한 리포트를 생성해주세요.

        - 분석 기간: {start_date} ~ {end_date}
        - 최다 소모 품목 Top 3 (수량): {top_items_dict}
        
        [리포트 작성 가이드]
        1. **개요:** 분석 기간과 핵심 내용을 한두 문장으로 요약합니다.
        2. **주요 동향:** 최다 소모 품목을 바탕으로 어떤 유형의 환자가 많았을지 추정하고, 재고 관리의 특징을 분석합니다. (예: "독감 검사 키트의 소모량이 가장 많은 것으로 보아, 호흡기 질환 환자 방문이 잦았던 것으로 보입니다.")
        3. **결론 및 제언:** 분석 결과를 바탕으로 다음 달에 준비해야 할 재고나 관리 포인트를 제안합니다.
        """
        # --- Gemini API 호출 (실제 호출 코드로 교체) ---
        model = genai.GenerativeModel('models/gemini-2.5-flash') # 또는 OpenAI 모델
        response = model.generate_content(prompt)
        report_text = response.text

        # --- 그래프 데이터 생성 (CSV 컬럼명에 맞게 수정) ---
        # 1. 품목별 소모량 (Bar Chart 용)
        items_by_usage = usage_df.groupby('item_name')['quantity'].sum().reset_index().sort_values(by='quantity', ascending=False)
        
        # 2. 카테고리별 소모량 (Pie Chart 용)
        category_by_usage = usage_df.groupby('category')['quantity'].sum().reset_index()

        # 3. 출고 vs 폐기 현황 (Stacked Bar Chart 용)
        usage_vs_disposal = df.pivot_table(index='item_name', 
                                           columns='transaction_type', 
                                           values='quantity', 
                                           aggfunc='sum', 
                                           fill_value=0)
        # '출고', '폐기' 데이터만 선택하고, 둘 중 하나라도 0 이상인 품목만 필터링
        if '출고' not in usage_vs_disposal: usage_vs_disposal['출고'] = 0
        if '폐기' not in usage_vs_disposal: usage_vs_disposal['폐기'] = 0
        usage_vs_disposal = usage_vs_disposal[['출고', '폐기']].reset_index()
        
        # --- ✨ 'any()' 오류 수정 ---
        # 'numeric_only' 인수를 사용하지 않는 방식으로 수정하여 이전 버전의 Pandas와 호환되도록 합니다.
        usage_vs_disposal = usage_vs_disposal[(usage_vs_disposal['출고'] > 0) | (usage_vs_disposal['폐기'] > 0)]


        return jsonify({
            "report_text": report_text,
            "graphs": {
                "by_item": items_by_usage.to_dict('records'),
                "by_category": category_by_usage.to_dict('records'),
                "usage_vs_disposal": usage_vs_disposal.to_dict('records')
            }
        })

    except Exception as e:
        return jsonify({"message": f"파일 처리 중 오류 발생: {str(e)}"}), 500
