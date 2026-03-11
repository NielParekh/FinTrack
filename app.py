from flask import Flask, request, jsonify, send_from_directory
from flask_cors import CORS
import json
import os
import logging
from logging.handlers import RotatingFileHandler
from datetime import datetime
from pathlib import Path
from schema import schema

app = Flask(__name__)
CORS(app)

# Logging (writes to logs/splitcash.log)
LOGS_DIR = Path('logs')
LOGS_DIR.mkdir(exist_ok=True)
LOG_FILE = LOGS_DIR / 'splitcash.log'

# Clear log file on server start
if LOG_FILE.exists():
    LOG_FILE.unlink()

file_handler = RotatingFileHandler(LOG_FILE, maxBytes=1_000_000, backupCount=5, encoding='utf-8')
file_handler.setLevel(logging.INFO)
file_handler.setFormatter(logging.Formatter('%(asctime)s %(levelname)s [%(name)s] %(message)s'))

console_handler = logging.StreamHandler()
console_handler.setLevel(logging.INFO)
console_handler.setFormatter(logging.Formatter('%(asctime)s %(levelname)s [%(name)s] %(message)s'))

root_logger = logging.getLogger()
root_logger.setLevel(logging.INFO)
root_logger.addHandler(file_handler)
root_logger.addHandler(console_handler)

# Ensure Flask + Werkzeug (dev server) logs also go to the same file
app.logger.handlers = []
app.logger.propagate = True
logging.getLogger('werkzeug').handlers = []
logging.getLogger('werkzeug').propagate = True

# Data directory and file
DATA_DIR = Path('data')
DATA_FILE = DATA_DIR / 'transactions.json'
INVESTMENTS_FILE = DATA_DIR / 'investments.json'
INVESTMENT_HISTORY_FILE = DATA_DIR / 'investment_history.json'

# Allowed categories for expenses
ALLOWED_CATEGORIES = {'Food', 'Rent', 'Travel', 'Misc'}

# Ensure data directory exists
DATA_DIR.mkdir(exist_ok=True)

# Initialize empty transactions file if it doesn't exist
if not DATA_FILE.exists():
    with open(DATA_FILE, 'w') as f:
        json.dump([], f)

# Initialize investments file if it doesn't exist
if not INVESTMENTS_FILE.exists():
    with open(INVESTMENTS_FILE, 'w') as f:
        json.dump({'bank_balance': 0.0, 'hysa_balance': 0.0, 'stock_value': 0.0, 'last_updated': None}, f)

if not INVESTMENT_HISTORY_FILE.exists():
    with open(INVESTMENT_HISTORY_FILE, 'w') as f:
        json.dump([], f)


def read_investments():
    try:
        with open(INVESTMENTS_FILE, 'r') as f:
            return json.load(f)
    except (FileNotFoundError, json.JSONDecodeError):
        return {'bank_balance': 0.0, 'stock_value': 0.0, 'last_updated': None}


def write_investments(data):
    with open(INVESTMENTS_FILE, 'w') as f:
        json.dump(data, f, indent=2)


def read_investment_history():
    try:
        with open(INVESTMENT_HISTORY_FILE, 'r') as f:
            return json.load(f)
    except (FileNotFoundError, json.JSONDecodeError):
        return []


def write_investment_history(data):
    with open(INVESTMENT_HISTORY_FILE, 'w') as f:
        json.dump(data, f, indent=2)


def read_transactions():
    """Read all transactions from JSON file"""
    try:
        with open(DATA_FILE, 'r') as f:
            return json.load(f)
    except (FileNotFoundError, json.JSONDecodeError):
        return []


def write_transactions(transactions):
    """Write transactions to JSON file"""
    with open(DATA_FILE, 'w') as f:
        json.dump(transactions, f, indent=2)


def get_next_id(transactions):
    """Get the next available ID"""
    if not transactions:
        return 1
    return max(t['id'] for t in transactions) + 1


def filter_transactions(transactions, type_filter=None, month=None, year=None):
    """Filter transactions based on criteria"""
    filtered = transactions
    
    if type_filter:
        filtered = [t for t in filtered if t['type'] == type_filter]
    
    if year and month:
        filtered = [t for t in filtered if 
                   datetime.strptime(t['date'], '%Y-%m-%d').year == int(year) and
                   datetime.strptime(t['date'], '%Y-%m-%d').month == int(month)]
    elif year:
        filtered = [t for t in filtered if 
                   datetime.strptime(t['date'], '%Y-%m-%d').year == int(year)]
    
    return filtered


# Serve only specific static files (security: don't expose entire directory)
ALLOWED_STATIC_FILES = {'index.html', 'styles.css', 'app.js'}

@app.route('/')
def index():
    return send_from_directory(app.root_path, 'index.html')

@app.route('/<path:filename>')
def serve_static(filename):
    """Serve only whitelisted static files"""
    if filename in ALLOWED_STATIC_FILES:
        return send_from_directory(app.root_path, filename)
    return jsonify({'error': 'Not found'}), 404

# Basic request logging
@app.before_request
def log_request():
    logging.getLogger('request').info('%s %s', request.method, request.path)

@app.after_request
def log_response(response):
    logging.getLogger('response').info('%s %s -> %s', request.method, request.path, response.status_code)
    return response

# GraphQL Endpoint
@app.route('/graphql', methods=['GET', 'POST'])
def graphql_endpoint():
    if request.method == 'GET':
        return send_from_directory(app.root_path, 'graphiql.html')
    data = request.get_json()
    result = schema.execute(
        data.get('query', ''),
        variable_values=data.get('variables'),
        operation_name=data.get('operationName')
    )
    response = {}
    if result.data is not None:
        response['data'] = result.data
    if result.errors:
        response['errors'] = [{'message': e.message} for e in result.errors]
    return jsonify(response)

# Legacy REST API Routes (kept for backward compatibility)
# These can be removed after frontend is fully migrated to GraphQL

@app.route('/api/transactions', methods=['GET'])
def get_transactions():
    """Get all transactions with optional filters"""
    try:
        transactions = read_transactions()
        
        type_filter = request.args.get('type')
        month = request.args.get('month')
        year = request.args.get('year')
        
        filtered = filter_transactions(transactions, type_filter, month, year)
        
        # Sort by date descending, then by created_at descending
        filtered.sort(key=lambda x: (
            x['date'],
            x.get('created_at', '')
        ), reverse=True)
        
        return jsonify(filtered)
    except Exception as e:
        return jsonify({'error': str(e)}), 500


@app.route('/api/transactions', methods=['POST'])
def create_transaction():
    """Create a new transaction"""
    try:
        data = request.json
        type_val = data.get('type')
        amount = data.get('amount')
        category = data.get('category')
        date = data.get('date')
        
        # Validation
        if not type_val or not amount or not date:
            return jsonify({'error': 'Missing required fields'}), 400
        
        if type_val not in ['expense', 'income']:
            return jsonify({'error': 'Type must be either "expense" or "income"'}), 400
        
        if float(amount) <= 0:
            return jsonify({'error': 'Amount must be greater than 0'}), 400
        
        # Category validation: required for expenses, ignored for income
        if type_val == 'expense':
            if not category:
                return jsonify({'error': 'Category is required for expenses'}), 400
            if category not in ALLOWED_CATEGORIES:
                return jsonify({'error': f'Category must be one of {sorted(ALLOWED_CATEGORIES)}'}), 400
        else:
            category = None
        
        transactions = read_transactions()
        
        new_transaction = {
            'id': get_next_id(transactions),
            'type': type_val,
            'amount': float(amount),
            'category': category if category else None,
            'date': date,
            'created_at': datetime.now().isoformat()
        }
        
        transactions.append(new_transaction)
        write_transactions(transactions)
        
        return jsonify(new_transaction), 201
    except Exception as e:
        return jsonify({'error': str(e)}), 500


@app.route('/api/transactions/<int:transaction_id>', methods=['PATCH'])
def update_transaction(transaction_id):
    """Update an existing transaction (partial update)"""
    try:
        data = request.json
        type_val = data.get('type')
        amount = data.get('amount')
        category = data.get('category')
        date = data.get('date')
        
        # Validation
        if not type_val or not amount or not date:
            return jsonify({'error': 'Missing required fields'}), 400
        
        if type_val not in ['expense', 'income']:
            return jsonify({'error': 'Type must be either "expense" or "income"'}), 400
        
        if float(amount) <= 0:
            return jsonify({'error': 'Amount must be greater than 0'}), 400
        
        # Category validation: required for expenses, ignored for income
        if type_val == 'expense':
            if not category:
                return jsonify({'error': 'Category is required for expenses'}), 400
            if category not in ALLOWED_CATEGORIES:
                return jsonify({'error': f'Category must be one of {sorted(ALLOWED_CATEGORIES)}'}), 400
        else:
            category = None
        
        transactions = read_transactions()
        
        # Find and update transaction
        for i, t in enumerate(transactions):
            if t['id'] == transaction_id:
                transactions[i].update({
                    'type': type_val,
                    'amount': float(amount),
                    'category': category if category else None,
                    'date': date
                })
                write_transactions(transactions)
                return jsonify(transactions[i])
        
        return jsonify({'error': 'Transaction not found'}), 404
    except Exception as e:
        return jsonify({'error': str(e)}), 500


@app.route('/api/transactions/<int:transaction_id>', methods=['DELETE'])
def delete_transaction(transaction_id):
    """Delete a transaction"""
    try:
        transactions = read_transactions()
        
        # Find and remove transaction
        for i, t in enumerate(transactions):
            if t['id'] == transaction_id:
                transactions.pop(i)
                write_transactions(transactions)
                return jsonify({'success': True})
        
        return jsonify({'error': 'Transaction not found'}), 404
    except Exception as e:
        return jsonify({'error': str(e)}), 500


@app.route('/api/summary', methods=['GET'])
def get_summary():
    """Get financial summary"""
    try:
        transactions = read_transactions()
        
        month = request.args.get('month')
        year = request.args.get('year')
        
        filtered = filter_transactions(transactions, None, month, year)
        
        total_income = sum(t['amount'] for t in filtered if t['type'] == 'income')
        total_expenses = sum(t['amount'] for t in filtered if t['type'] == 'expense')
        balance = total_income - total_expenses
        
        return jsonify({
            'totalIncome': total_income,
            'totalExpenses': total_expenses,
            'balance': balance
        })
    except Exception as e:
        return jsonify({'error': str(e)}), 500


if __name__ == '__main__':
    # Get port from environment variable or default to 5000
    port = int(os.environ.get('PORT', 5000))
    # Only run in debug mode if explicitly set
    debug = os.environ.get('FLASK_DEBUG', 'False').lower() == 'true'
    app.run(debug=debug, host='0.0.0.0', port=port)

