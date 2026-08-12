#!/usr/bin/env python3
"""Draw the FinTrack app icon as a single-page PDF (vector).

No third-party deps: we emit PDF operators directly. sips can then
rasterize the PDF to any size for the .icns set.

Design: white polyline chart with a node at the peak, on a rounded-square
blue gradient ground (--primary #0071e3), macOS Big Sur proportions.
"""
import zlib

S = 1024.0  # canvas, points

# --- Big Sur icon geometry -------------------------------------------------
# The rounded square occupies ~82% of the canvas, centred, leaving the
# transparent margin macOS expects (it does not add padding itself).
INSET = S * 0.09
SQ = S - 2 * INSET          # 839.68
R = SQ * 0.2237             # Big Sur corner radius ratio
K = 0.5523                  # circle->bezier constant

# --- palette ---------------------------------------------------------------
TOP = (0x2E / 255, 0x8B / 255, 0xF0 / 255)   # lighter blue, top of gradient
BOT = (0x00 / 255, 0x5A / 255, 0xC8 / 255)   # deeper blue, bottom
WHITE = (1.0, 1.0, 1.0)


def rounded_rect(x, y, w, h, r):
    """Path ops for a rounded rect, starting bottom-left going clockwise."""
    c = r * K
    return f"""{x + r:.2f} {y:.2f} m
{x + w - r:.2f} {y:.2f} l
{x + w - r + c:.2f} {y:.2f} {x + w:.2f} {y + r - c:.2f} {x + w:.2f} {y + r:.2f} c
{x + w:.2f} {y + h - r:.2f} l
{x + w:.2f} {y + h - r + c:.2f} {x + w - r + c:.2f} {y + h:.2f} {x + w - r:.2f} {y + h:.2f} c
{x + r:.2f} {y + h:.2f} l
{x + r - c:.2f} {y + h:.2f} {x:.2f} {y + h - r + c:.2f} {x:.2f} {y + h - r:.2f} c
{x:.2f} {y + r:.2f} l
{x:.2f} {y + r - c:.2f} {x + r - c:.2f} {y:.2f} {x + r:.2f} {y:.2f} c
h"""


def circle(cx, cy, r):
    c = r * K
    return f"""{cx + r:.2f} {cy:.2f} m
{cx + r:.2f} {cy + c:.2f} {cx + c:.2f} {cy + r:.2f} {cx:.2f} {cy + r:.2f} c
{cx - c:.2f} {cy + r:.2f} {cx - r:.2f} {cy + c:.2f} {cx - r:.2f} {cy:.2f} c
{cx - r:.2f} {cy - c:.2f} {cx - c:.2f} {cy - r:.2f} {cx:.2f} {cy - r:.2f} c
{cx + c:.2f} {cy - r:.2f} {cx + r:.2f} {cy - c:.2f} {cx + r:.2f} {cy:.2f} c
h"""


# --- chart geometry --------------------------------------------------------
# Four points climbing left-to-right with one shallow retracement. A deep
# early dip makes the silhouette read as a checkmark rather than a chart,
# so point 2 sits only slightly below point 1 and the net trend stays up.
PTS_F = [(0.16, 0.34), (0.38, 0.27), (0.60, 0.52), (0.84, 0.72)]
PTS = [(INSET + fx * SQ, INSET + fy * SQ) for fx, fy in PTS_F]

STROKE = SQ * 0.075        # line weight, heavy enough to survive 16px
NODE_R = SQ * 0.070        # peak node radius

content = []

# ground
content.append("q")
content.append(rounded_rect(INSET, INSET, SQ, SQ, R))
content.append("W n")                     # clip to the rounded square
content.append("/Sh0 sh")                 # axial gradient fills the clip
content.append("Q")

# polyline
content.append("q")
content.append(f"{WHITE[0]} {WHITE[1]} {WHITE[2]} RG")
content.append(f"{STROKE:.2f} w")
content.append("1 J")                     # round caps
content.append("1 j")                     # round joins
content.append(f"{PTS[0][0]:.2f} {PTS[0][1]:.2f} m")
for x, y in PTS[1:]:
    content.append(f"{x:.2f} {y:.2f} l")
content.append("S")
content.append("Q")

# peak node: knock out a ring so the dot reads as a distinct node, then fill
content.append("q")
content.append(f"{WHITE[0]} {WHITE[1]} {WHITE[2]} rg")
content.append(circle(PTS[-1][0], PTS[-1][1], NODE_R))
content.append("f")
content.append("Q")

stream = "\n".join(content).encode("ascii")
comp = zlib.compress(stream)

# --- assemble the PDF ------------------------------------------------------
objs = {}

objs[1] = b"<< /Type /Catalog /Pages 2 0 R >>"
objs[2] = b"<< /Type /Pages /Kids [3 0 R] /Count 1 >>"
objs[3] = (
    f"<< /Type /Page /Parent 2 0 R /MediaBox [0 0 {S:.0f} {S:.0f}] "
    f"/Group << /S /Transparency /CS /DeviceRGB >> "
    f"/Resources << /Shading << /Sh0 5 0 R >> >> /Contents 4 0 R >>"
).encode("ascii")
objs[4] = (
    b"<< /Length " + str(len(comp)).encode() + b" /Filter /FlateDecode >>\nstream\n"
    + comp + b"\nendstream"
)
# axial shading, top -> bottom
objs[5] = (
    f"<< /ShadingType 2 /ColorSpace /DeviceRGB "
    f"/Coords [0 {INSET + SQ:.2f} 0 {INSET:.2f}] "
    f"/Extend [true true] /Function 6 0 R >>"
).encode("ascii")
objs[6] = (
    f"<< /FunctionType 2 /Domain [0 1] /N 1 "
    f"/C0 [{TOP[0]:.4f} {TOP[1]:.4f} {TOP[2]:.4f}] "
    f"/C1 [{BOT[0]:.4f} {BOT[1]:.4f} {BOT[2]:.4f}] >>"
).encode("ascii")

out = bytearray(b"%PDF-1.5\n%\xe2\xe3\xcf\xd3\n")
offsets = {}
for n in sorted(objs):
    offsets[n] = len(out)
    out += f"{n} 0 obj\n".encode() + objs[n] + b"\nendobj\n"

xref = len(out)
out += f"xref\n0 {len(objs) + 1}\n".encode()
out += b"0000000000 65535 f \n"
for n in sorted(objs):
    out += f"{offsets[n]:010d} 00000 n \n".encode()
out += (
    f"trailer\n<< /Size {len(objs) + 1} /Root 1 0 R >>\nstartxref\n{xref}\n%%EOF\n"
).encode()

import sys
open(sys.argv[1], "wb").write(bytes(out))
print(f"wrote {sys.argv[1]} ({len(out)} bytes)")
