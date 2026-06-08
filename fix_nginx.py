import paramiko

host = "2.24.75.193"
user = "root"
password = "Ugaz#@2026ok"

client = paramiko.SSHClient()
client.set_missing_host_key_policy(paramiko.AutoAddPolicy())

try:
    client.connect(hostname=host, username=user, password=password)
    sftp = client.open_sftp()
    
    remote_path = "/etc/nginx/sites-available/judicore"
    local_path = "judicore_nginx.conf"
    
    # Download
    sftp.get(remote_path, local_path)
    
    # Modify
    with open(local_path, "r", encoding="utf-8") as f:
        content = f.read()
        
    new_block = """
    # -- Piece API -> Next.js (3000) --
    location /api/piece-generation {
        proxy_pass http://127.0.0.1:3000;
        proxy_http_version 1.1;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
        proxy_buffering off;
        proxy_read_timeout 300;
        proxy_send_timeout 300;
        proxy_connect_timeout 60;
        client_max_body_size 100M;
    }

    location /api/piece-evaluation {
        proxy_pass http://127.0.0.1:3000;
        proxy_http_version 1.1;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
    }
"""
    if "location /api/piece-generation" not in content:
        content = content.replace("location /api/review-studio/ {", new_block + "\n    location /api/review-studio/ {")
        
        with open(local_path, "w", encoding="utf-8") as f:
            f.write(content)
            
        # Upload
        sftp.put(local_path, remote_path)
        
        # Reload
        client.exec_command("systemctl reload nginx")
        print("Nginx configuration updated and reloaded.")
    else:
        print("Nginx configuration already contains piece-generation.")
        
except Exception as e:
    print(f"Error: {e}")
finally:
    client.close()
