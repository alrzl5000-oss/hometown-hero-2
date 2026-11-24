import sys, importlib; sys.path.insert(0,'.')
from ds import doc
import re
def quote_attrs(html):
    def fix_tag(m):
        t = m.group(0)
        if t.startswith("<!") or t.startswith("</"): return t
        t = re.sub(r"(\s[\w:-]+)='([^']*)'", r'\1="\2"', t)
        t = re.sub(r'(\s[\w:-]+)=([^\s"\'>][^\s>]*?)(?=[\s>]|/>)', r'\1="\2"', t)
        return t
    head, sep, rest = html.partition("<x-dc>")
    body, sep2, tail = rest.partition("</x-dc>")
    hel, sep3, after = body.partition("</helmet>")
    after = re.sub(r"<[^<>]+>", fix_tag, after)
    return head + sep + hel + sep3 + after + sep2 + tail
OUT="/tmp/claude-0/-home-claude/025c504b-4bb5-5716-9fa6-a39e1e42418b/scratchpad/ui-mockup/project"
if __name__ != "__main__": mods=[]
else: mods=sys.argv[1:] or ["n_battle"]
allf={}
THEME = "C"
import themes
for m in mods:
    mod = importlib.import_module(m)
    for n,(t,body,w,h) in mod.FILES.items():
        open(f"{OUT}/{n}.dc.html","w").write(themes.apply_theme(quote_attrs(doc(t,body,w,h)), THEME)); allf[n]=(w,h,t)
import json; json.dump(allf,open(f"/tmp/claude-0/-home-claude/025c504b-4bb5-5716-9fa6-a39e1e42418b/scratchpad/n_sizes_{'_'.join(mods)}.json","w"),ensure_ascii=False)
print(allf)
