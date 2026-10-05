import re, time
with open('frontend/index.html', 'r', encoding='utf-8') as f:
    h = f.read()

v = int(time.time())
if '?v=' in h:
    h = re.sub(r'/css/style\.css\?v=\d+', f'/css/style.css?v={v}', h)
else:
    h = h.replace('/css/style.css', f'/css/style.css?v={v}')

with open('frontend/index.html', 'w', encoding='utf-8') as f:
    f.write(h)
