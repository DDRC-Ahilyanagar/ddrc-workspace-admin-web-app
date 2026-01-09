#!/usr/bin/env python3
"""
Flask API server wrapper for the daily reports service
Can be called from Next.js scheduled jobs
"""

from flask import Flask, request, jsonify
from functools import wraps
import os
import logging
from daily_reports_service import main as run_daily_reports

app = Flask(__name__)
logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)


def require_auth(f):
    """Decorator to require API token authentication"""
    @wraps(f)
    def decorated_function(*args, **kwargs):
        auth_header = request.headers.get('Authorization', '')
        expected_token = os.getenv('DAILY_STATS_API_TOKEN', '')
        
        if expected_token and auth_header != f'Bearer {expected_token}':
            return jsonify({'ok': False, 'error': 'Unauthorized'}), 401
        
        return f(*args, **kwargs)
    return decorated_function


@app.route('/health', methods=['GET'])
def health():
    """Health check endpoint"""
    return jsonify({'ok': True, 'status': 'healthy'})


@app.route('/generate-reports', methods=['POST'])
@require_auth
def generate_reports():
    """Generate and send daily reports"""
    try:
        logger.info("Received request to generate daily reports")
        
        # Run the daily reports service
        run_daily_reports()
        
        return jsonify({
            'ok': True,
            'message': 'Daily reports generated and sent successfully'
        })
        
    except Exception as e:
        logger.error(f"Error generating reports: {str(e)}", exc_info=True)
        return jsonify({
            'ok': False,
            'error': str(e)
        }), 500


if __name__ == '__main__':
    port = int(os.getenv('PORT', 8000))
    app.run(host='0.0.0.0', port=port, debug=False)

