import os
import server
from config import host, port
from werkzeug.serving import run_simple

run_simple(host, port, server.application, use_reloader=True, static_files={'/':os.path.join(os.path.dirname(__file__), 'public')})
