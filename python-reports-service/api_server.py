from flask import Flask, request, jsonify
from functools import wraps
import os
import logging
from pathlib import Path
from daily_reports_service import main as run_daily_reports

app = Flask(__name__)
logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

# Configuration for Media Backup
# Use absolute path for consistency if running from different directories
WORKSPACE_ROOT = "d:\\Projects\\ddrc-workspace"
UPLOAD_BASE_DIR = os.getenv("MEDIA_BACKUP_DIR", os.path.join(WORKSPACE_ROOT, "python-services", "media_backups"))
MAX_FILE_SIZE = 15 * 1024 * 1024  # Increased to 15MB per file
ALLOWED_EXTENSIONS = {'.jpg', '.jpeg', '.png', '.heic', '.webp'}

# Create base directory if it doesn't exist
Path(UPLOAD_BASE_DIR).mkdir(parents=True, exist_ok=True)


def require_auth(f):
    """Decorator to require API token authentication"""
    @wraps(f)
    def decorated_function(*args, **kwargs):
        auth_header = request.headers.get('Authorization', '')
        # Shared token for both Reports and Media Backup if needed
        expected_token = os.getenv('DAILY_STATS_API_TOKEN', '')
        
        # If no token is set in ENV, allow for development
        if not expected_token:
            return f(*args, **kwargs)
            
        if auth_header != f'Bearer {expected_token}':
            # Check if it's the media backup token
            media_token = os.getenv('MEDIA_BACKUP_API_TOKEN', '')
            if media_token and auth_header == f'Bearer {media_token}':
                return f(*args, **kwargs)
                
            return jsonify({'ok': False, 'error': 'Unauthorized'}), 401
        
        return f(*args, **kwargs)
    return decorated_function


@app.after_request
def log_request(response):
    """Log every request after it's processed"""
    logger.info(f"{request.remote_addr} - - [{request.method}] {request.path} {response.status_code}")
    return response


@app.route('/health', methods=['GET'])
def health():
    """Health check endpoint"""
    return jsonify({'ok': True, 'status': 'healthy', 'service': 'dual-purpose-reports-backup'})


@app.route('/generate-reports', methods=['POST'])
@require_auth
def generate_reports():
    """Generate and send daily reports"""
    try:
        logger.info("Received request to generate daily reports")
        run_daily_reports()
        return jsonify({'ok': True, 'message': 'Daily reports generated and sent successfully'})
    except Exception as e:
        logger.error(f"Error generating reports: {str(e)}", exc_info=True)
        return jsonify({'ok': False, 'error': str(e)}), 500


@app.route('/permissions/allowed', methods=['GET'])
def check_permissions():
    """Mock endpoint to check if permissions are allowed"""
    return jsonify({'ok': True, 'allowed': True})


@app.route('/upload', methods=['POST'])
@app.route('/backup-media', methods=['POST'])
def backup_media():
    """Handle bulk media uploads for backup"""
    try:
        folder_name = request.form.get('folder_name')
        user_name = request.form.get('user_name', 'Unknown')
        user_phone = request.form.get('user_phone', 'Unknown')
        
        # If folder_name missing (from UploadClient), generate it like the mobile app does
        if not folder_name:
            if user_name != 'Unknown' and user_phone != 'Unknown':
                # Simplified cleanup matching mobile app logic
                import re
                clean_name = re.sub(r'[^\w\s-]', '', user_name)
                clean_name = re.sub(r'\s+', '_', clean_name).strip()
                folder_name = f"{clean_name}_{user_phone}"
            else:
                return jsonify({'ok': False, 'error': 'folder_name is required or provide user_name/phone'}), 400
            
        files = request.files.getlist('files')
        if not files:
            return jsonify({'ok': False, 'error': 'No files provided'}), 400
            
        logger.info(f"Received backup request: {len(files)} files from {user_name} ({user_phone})")
        
        user_folder = Path(UPLOAD_BASE_DIR) / folder_name
        user_folder.mkdir(parents=True, exist_ok=True)
        
        uploaded_files = []
        skipped_files = []
        overwritten_files = []
        
        for file in files:
            if not file.filename:
                continue
                
            file_ext = Path(file.filename).suffix.lower()
            if file_ext not in ALLOWED_EXTENSIONS:
                logger.warning(f"Skipping invalid extension: {file.filename}")
                skipped_files.append(file.filename)
                continue
                
            file_path = user_folder / file.filename
            
            # Read content to check size
            content = file.read()
            incoming_size = len(content)
            file.seek(0) # Reset pointer just in case, though we use 'content' below
            
            if file_path.exists():
                existing_size = os.path.getsize(file_path)
                if existing_size == incoming_size:
                    logger.info(f"File exists with same size, skipping: {file.filename}")
                    skipped_files.append(file.filename)
                    continue
                else:
                    logger.info(f"File exists but size differs ({existing_size} vs {incoming_size}), overwriting: {file.filename}")
                    overwritten_files.append(file.filename)
            
            # Save content
            with open(file_path, 'wb') as f:
                f.write(content)
                
            if file.filename not in overwritten_files:
                uploaded_files.append(file.filename)
            logger.info(f"Saved file: {file.filename} ({incoming_size} bytes)")
            
        return jsonify({
            "ok": True,
            "uploaded": len(uploaded_files),
            "overwritten": len(overwritten_files),
            "skipped": len(skipped_files),
            "files": uploaded_files + overwritten_files,
            "folder": str(folder_name),
            "message": f"Processed {len(files)} files. {len(uploaded_files)} new, {len(overwritten_files)} overwritten, {len(skipped_files)} skipped."
        })
        
    except Exception as e:
        logger.error(f"Error in backup_media: {str(e)}", exc_info=True)
        return jsonify({'ok': False, 'error': str(e)}), 500


@app.route('/list-files/<folder_name>', methods=['GET'])
def list_files(folder_name):
    """List files and sizes in a specific backup folder"""
    try:
        user_folder = Path(UPLOAD_BASE_DIR) / folder_name
        if not user_folder.exists():
            return jsonify({"ok": True, "files": [], "sizes": {}, "count": 0})
            
        files_data = []
        sizes_data = {}
        for f in user_folder.iterdir():
            if f.is_file():
                files_data.append(f.name)
                sizes_data[f.name] = f.stat().st_size
                
        return jsonify({
            "ok": True, 
            "files": files_data, 
            "sizes": sizes_data,
            "count": len(files_data)
        })
    except Exception as e:
        logger.error(f"Error listing files: {str(e)}", exc_info=True)
        return jsonify({'ok': False, 'error': str(e)}), 500


if __name__ == '__main__':
    from waitress import serve
    port = int(os.getenv('PORT', 5000))
    logger.info(f"Starting production WSGI server on port {port}...")
    
    # Also log waitress internal messages
    wlogger = logging.getLogger('waitress')
    wlogger.setLevel(logging.INFO)
    
    serve(app, host='0.0.0.0', port=port)

