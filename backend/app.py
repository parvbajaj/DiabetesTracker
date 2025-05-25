from flask import Flask, request, jsonify, send_file
from flask_cors import CORS
import pandas as pd
import os
from datetime import datetime

app = Flask(__name__)

# Allow only your Vercel frontend to access the backend
CORS(app, origins=["https://diabetes-tracker-two.vercel.app"])

EXCEL_PATH = "sugar_chart.xlsx"

HEADERS = [
    'DATE',
    'FASTING',
    'BREAKFAST INSULIN',
    '2 HRS POST BREAKFAST',
    'PRE LUNCH',
    'LUNCH INSULIN',
    '2 HR POST LUNCH',
    'PRE DINNER',
    'DINNER INSULIN',
    '2 HR POST DINNER',
    'Lantus'
]

INSULIN_FIELDS = [
    'BREAKFAST INSULIN',
    'LUNCH INSULIN',
    'DINNER INSULIN',
    'Lantus'
]

STEPS = HEADERS[1:]

def load_or_create_excel():
    if not os.path.exists(EXCEL_PATH) or os.stat(EXCEL_PATH).st_size == 0:
        df = pd.DataFrame(columns=HEADERS)
        df.to_excel(EXCEL_PATH, index=False, engine='openpyxl')
    else:
        try:
            df = pd.read_excel(EXCEL_PATH, engine='openpyxl')
        except Exception:
            df = pd.DataFrame(columns=HEADERS)
            df.to_excel(EXCEL_PATH, index=False, engine='openpyxl')
    return df

@app.route('/current-step', methods=['GET'])
def get_current_step():
    df = load_or_create_excel()
    today = datetime.now().strftime('%d.%m.%Y')
    if len(df) == 0 or str(df.iloc[-1]['DATE']) != today:
        return jsonify({'step': STEPS[0], 'stepIndex': 0})
    last_row = df.iloc[-1]
    for idx, step in enumerate(STEPS):
        if pd.isna(last_row[step]):
            return jsonify({'step': step, 'stepIndex': idx})
    return jsonify({'step': None, 'stepIndex': len(STEPS)})

@app.route('/submit-step', methods=['POST'])
def submit_step():
    data = request.json
    value = data.get('value')
    step = data.get('step')
    # Auto-append " units" for insulin fields if not present
    if step in INSULIN_FIELDS and value and "unit" not in value.lower():
        value = f"{value} units"
    df = load_or_create_excel()
    today = datetime.now().strftime('%d.%m.%Y')
    if len(df) == 0 or str(df.iloc[-1]['DATE']) != today:
        new_row = {col: None for col in df.columns}
        new_row['DATE'] = today
        new_row[step] = value
        df = pd.concat([df, pd.DataFrame([new_row])], ignore_index=True)
    else:
        df.at[df.index[-1], step] = value
    df.to_excel(EXCEL_PATH, index=False, engine='openpyxl')
    return jsonify({'success': True})

@app.route('/edit-today', methods=['GET', 'POST'])
def edit_today():
    df = load_or_create_excel()
    today = datetime.now().strftime('%d.%m.%Y')
    if request.method == 'GET':
        if len(df) == 0 or str(df.iloc[-1]['DATE']) != today:
            return jsonify({step: "" for step in STEPS})
        row = df.iloc[-1]
        return jsonify({step: "" if pd.isna(row[step]) else str(row[step]) for step in STEPS})
    else:  # POST
        data = request.json
        if len(df) == 0 or str(df.iloc[-1]['DATE']) != today:
            new_row = {col: None for col in df.columns}
            new_row['DATE'] = today
            for step in STEPS:
                val = data.get(step, None)
                if step in INSULIN_FIELDS and val and "unit" not in str(val).lower():
                    val = f"{val} units"
                new_row[step] = val
            df = pd.concat([df, pd.DataFrame([new_row])], ignore_index=True)
        else:
            for step in STEPS:
                val = data.get(step, None)
                if step in INSULIN_FIELDS and val and "unit" not in str(val).lower():
                    val = f"{val} units"
                df.at[df.index[-1], step] = val
        df.to_excel(EXCEL_PATH, index=False, engine='openpyxl')
        return jsonify({'success': True})

@app.route('/reset-today', methods=['POST'])
def reset_today():
    df = load_or_create_excel()
    today = datetime.now().strftime('%d.%m.%Y')
    if len(df) > 0 and str(df.iloc[-1]['DATE']) == today:
        df = df.iloc[:-1]
        df.to_excel(EXCEL_PATH, index=False, engine='openpyxl')
        return jsonify({'success': True, 'message': "Today's entry reset"})
    else:
        return jsonify({'success': False, 'message': 'No entry for today to reset'})

@app.route('/show', methods=['GET'])
def show_table():
    df = load_or_create_excel()
    # Return all rows as list of dicts
    return jsonify({'columns': list(df.columns), 'rows': df.fillna("").astype(str).values.tolist()})

@app.route('/download', methods=['GET'])
def download_excel():
    return send_file(EXCEL_PATH, as_attachment=True)

if __name__ == '__main__':
    port = int(os.environ.get("PORT", 5050))  # Use Render's port if set, otherwise 5050 locally
    app.run(debug=True, host="0.0.0.0", port=port)