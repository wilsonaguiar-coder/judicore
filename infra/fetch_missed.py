import paramiko, json, sys

ssh = paramiko.SSHClient()
ssh.set_missing_host_key_policy(paramiko.AutoAddPolicy())
ssh.connect('2.24.75.193', username='root', password='Ugaz#@2026ok')

remote_script = r"""
import json
with open('/opt/judicore/packages/ai/quality-lab/output/results.json') as f:
    r = json.load(f)

target = 'paridade_rpps_inicial_0'
c = next((x for x in r if x.get('caseId') == target), None)
if not c:
    # fallback: show all RPPS MISSED
    missed = [x for x in r if x.get('trap') == 'STANCE_CONTRADICTION_RPPS' and x.get('trapOutcome') == 'MISSED']
    print('TOTAL_MISSED:', len(missed))
    for m in missed:
        print('caseId:', m.get('caseId'), 'documentType:', m.get('documentType'))
        print('DRAFT:', (m.get('draft') or '')[:4000])
        print('---')
    import sys; sys.exit(0)

print('caseId:', c.get('caseId'))
print('documentType:', c.get('documentType'))
print('trapOutcome:', c.get('trapOutcome'))
print('validationRules:', json.dumps([e['rule'] for e in c.get('validationErrors', [])]))
print('--- DRAFT ---')
print(c.get('draft', '[vazio]'))
"""

stdin, stdout, stderr = ssh.exec_command('python3 << \'PYEOF\'\n' + remote_script + '\nPYEOF')
out = stdout.read().decode('utf-8', errors='replace')
err = stderr.read().decode('utf-8', errors='replace')
print(out)
if err:
    print('STDERR:', err[:300], file=sys.stderr)
ssh.close()
