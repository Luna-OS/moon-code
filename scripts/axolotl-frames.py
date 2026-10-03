# Draws Axo, Moon Code's pixel axolotl, frame by frame.
W,H=26,20
def canvas(): return [['.']*W for _ in range(H)]
def put(c,x,y,ch):
    if 0<=x<W and 0<=y<H: c[y][x]=ch
def hline(c,x0,x1,y,ch):
    for x in range(x0,x1+1): put(c,x,y,ch)
def frame(eyes='open', gills=0, mouth='smile', arms='down', body_dy=0, tail=0, extra=None):
    c=canvas()
    dy=body_dy
    # head: rows 3..12, cols 6..19 (rounded)
    top=3+dy
    rows=[(9,16),(7,18),(6,19),(6,19),(6,19),(6,19),(6,19),(6,19),(7,18),(9,16)]
    for i,(a,b) in enumerate(rows):
        y=top+i
        hline(c,a,b,y,'W')
        put(c,a-1,y,'O'); put(c,b+1,y,'O')
    hline(c,9,16,top-1,'O'); hline(c,9,16,top+len(rows),'O')
    put(c,7,top,'O'); put(c,8,top,'O');put(c,17,top,'O');put(c,18,top,'O')
    put(c,6,top+1,'O');put(c,19,top+1,'O')
    put(c,6,top+8,'O');put(c,19,top+8,'O')
    put(c,7,top+9,'O');put(c,8,top+9,'O');put(c,17,top+9,'O');put(c,18,top+9,'O')
    # gills: three fronds a side; gills=0/1 wiggle
    w=gills
    L=[[(4,top+2),(3,top+1),(2,top+0-w),(1,top-1-w)],
       [(4,top+4),(3,top+4),(2,top+4-w),(1,top+3-w),(0,top+3-w)],
       [(4,top+6),(3,top+7),(2,top+8+w),(1,top+9+w)]]
    for fr in L:
        for j,(x,y) in enumerate(fr):
            ch='g' if j==0 else 'G'
            put(c,x,y,ch); put(c,25-x,y,ch)
    # stems join head
    for y in (top+2,top+4,top+6):
        put(c,5,y,'g'); put(c,20,y,'g')
    # eyes
    ey=top+4
    if eyes=='open':
        for x in (9,15):
            put(c,x,ey,'E');put(c,x+1,ey,'E');put(c,x,ey+1,'E');put(c,x+1,ey+1,'E');put(c,x,ey,'e')
    elif eyes=='closed':
        for x in (9,15): put(c,x,ey+1,'E');put(c,x+1,ey+1,'E')
    elif eyes=='happy':
        for x in (9,15): put(c,x,ey+1,'E');put(c,x+1,ey,'E');put(c,x+2,ey+1,'E')
    elif eyes=='focus':
        for x in (9,15): put(c,x,ey+1,'E');put(c,x+1,ey+1,'E');put(c,x,ey,'E');put(c,x+1,ey,'E')
    # cheeks
    put(c,8,ey+2,'C');put(c,17,ey+2,'C')
    # mouth
    my=ey+3
    if mouth=='smile': put(c,12,my,'M');put(c,13,my,'M')
    elif mouth=='open': put(c,12,my,'M');put(c,13,my,'M');put(c,12,my+1,'M');put(c,13,my+1,'M')
    elif mouth=='flat': put(c,12,my,'O');put(c,13,my,'O')
    # body rows below head
    by=3+11+max(dy,0) if False else top+11
    for i,(a,b) in enumerate([(9,16),(9,16),(9,16),(10,15)]):
        y=by+i
        hline(c,a,b,y,'W'); put(c,a-1,y,'O'); put(c,b+1,y,'O')
    hline(c,10,15,by+4,'O')
    put(c,11,by+1,'S');put(c,14,by+1,'S')
    # arms
    if arms=='down':
        put(c,7,by+1,'O');put(c,7,by+2,'W');put(c,6,by+2,'O');put(c,7,by+3,'O')
        put(c,18,by+1,'O');put(c,18,by+2,'W');put(c,19,by+2,'O');put(c,18,by+3,'O')
    elif arms=='typeA':
        put(c,7,by+0,'O');put(c,6,by+1,'O');put(c,7,by+1,'W');put(c,7,by+2,'O')
        put(c,18,by+1,'O');put(c,18,by+2,'W');put(c,19,by+2,'O');put(c,18,by+3,'O')
    elif arms=='typeB':
        put(c,7,by+1,'O');put(c,7,by+2,'W');put(c,6,by+2,'O');put(c,7,by+3,'O')
        put(c,18,by+0,'O');put(c,19,by+1,'O');put(c,18,by+1,'W');put(c,18,by+2,'O')
    elif arms=='up':
        put(c,7,by-1,'O');put(c,6,by-2,'O');put(c,7,by-2,'W');put(c,6,by-3,'O')
        put(c,18,by-1,'O');put(c,19,by-2,'O');put(c,18,by-2,'W');put(c,19,by-3,'O')
    # tail to the right
    ty=by+2
    t=tail
    pts_o=[(17,ty+1),(18,ty+1),(19,ty+1),(20,ty+0-t),(21,ty-1-t),(21,ty-2-t),(20,ty-2-t)]
    for (x,y) in [(17,ty),(18,ty),(19,ty),(20,ty-1-t)]: put(c,x,y,'W')
    for (x,y) in pts_o: put(c,x,y,'O')
    put(c,17,ty-1,'O');put(c,18,ty-1,'O');put(c,19,ty-1,'O');put(c,19,ty-2-t,'O')
    if extra: extra(c)
    return [''.join(r) for r in c]
P2={}
def laptop(phase):
    def f(c):
        by=14
        for y in range(by+1,by+5):
            for x in range(8,18): put(c,x,y,'L')
        hline(c,8,17,by+5,'K')
        for y in range(by+1,by+5): put(c,7,y,'O'); put(c,18,y,'O')
        hline(c,8,17,by,'O')
        # little crescent on the lid
        put(c,12,by+2,'m');put(c,12,by+3,'m');put(c,13,by+3,'m');put(c,13,by+1,'m')
        # paws on the keys
        if phase==0: put(c,9,by,'W');put(c,10,by,'W');put(c,16,by-1,'W');put(c,15,by-1,'W')
        else: put(c,9,by-1,'W');put(c,10,by-1,'W');put(c,16,by,'W');put(c,15,by,'W')
        # code sparks above
        sp=[(2,15),(23,12)] if phase==0 else [(1,12),(24,15)]
        for (x,y) in sp:
            put(c,x,y,'T');put(c,x-1,y,'t');put(c,x+1,y,'t');put(c,x,y-1,'t');put(c,x,y+1,'t')
    return f
def sparkle(c):
    for (x,y) in [(2,1),(23,1),(1,15),(24,14)]:
        put(c,x,y,'T');put(c,x-1,y,'t');put(c,x+1,y,'t');put(c,x,y-1,'t');put(c,x,y+1,'t')
frames={
 'idle':[frame(),frame(eyes='closed')],
 'sleep':[frame(eyes='closed',mouth='flat')],
 'work':[frame(eyes='focus',gills=1,arms='none',mouth='flat',extra=laptop(0)),frame(eyes='focus',gills=0,arms='none',mouth='flat',tail=1,extra=laptop(1))],
 'done':[frame(eyes='happy',mouth='open',gills=1,extra=sparkle)],
}

# Writes src/mascot/frames.ts (run: python3 scripts/axolotl-frames.py).
import os
root=os.path.join(os.path.dirname(os.path.abspath(__file__)),'..')
out=["/* Generated by scripts/axolotl-frames.py: the pixel frames of Axo, Moon Code's axolotl. */","",
     '/** 26 × 20 pixels; one string per row, each character a colour in AXOLOTL_COLORS, "." clear. */',
     "export const AXOLOTL_FRAMES = {"]
for k,v in frames.items():
    out.append(f"  {k}: [")
    for fr in v:
        out.append("    [")
        out += [f'      "{row}",' for row in fr]
        out.append("    ],")
    out.append("  ],")
out.append("} as const;")
open(os.path.join(root,'src','mascot','frames.ts'),'w').write("\n".join(out)+"\n")
