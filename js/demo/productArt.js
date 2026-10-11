// English header: Procedural product artwork for the standalone (no-backend) storefront.
// Every product photo, category icon and hero banner is drawn as an SVG string in the
// colour of the selected variant, then turned into a base64 data URI - so the deployed site
// has zero external image dependencies and the colour swatches visibly change the picture.
// All functions are pure (no DOM access), which also lets them run in Node for testing.
// To use real photos later, replace the image URLs in demo/catalog.js (or switch to the real
// backend in config.js) - nothing else in the app depends on how these images are made.

const W = 600;
const H = 750;
const CX = 300;

// ---------------------------------------------------------------------------
// Colour helpers
// ---------------------------------------------------------------------------

// Splits "#rrggbb" into [r, g, b].
function parseHex(hex) {
    const h = hex.replace('#', '');
    return [parseInt(h.slice(0, 2), 16), parseInt(h.slice(2, 4), 16), parseInt(h.slice(4, 6), 16)];
}

// Joins [r, g, b] back into "#rrggbb", clamping each channel.
function toHex(rgb) {
    return '#' + rgb
        .map(v => Math.round(Math.min(255, Math.max(0, v))).toString(16).padStart(2, '0'))
        .join('');
}

// Linear blend of two hex colours; t = 0 keeps `hex`, t = 1 gives `otherHex`.
function mix(hex, otherHex, t) {
    const a = parseHex(hex);
    const b = parseHex(otherHex);
    return toHex(a.map((v, i) => v + (b[i] - v) * t));
}

const darken = (hex, t) => mix(hex, '#000000', t);
const lighten = (hex, t) => mix(hex, '#ffffff', t);

// Perceived brightness 0..1, used to choose readable accents and backdrops.
function luminance(hex) {
    const [r, g, b] = parseHex(hex);
    return (0.299 * r + 0.587 * g + 0.114 * b) / 255;
}

// Derives every tone a garment needs (shadow, highlight, stitching) from one base colour.
function palette(hex) {
    const lum = luminance(hex);
    return {
        base: hex,
        dark: darken(hex, 0.2),
        darker: darken(hex, 0.38),
        light: lighten(hex, 0.2),
        stitch: lum > 0.55 ? darken(hex, 0.32) : lighten(hex, 0.34),
        accent: lum > 0.5 ? '#3a3330' : '#efe6d8',
        lum
    };
}

// ---------------------------------------------------------------------------
// Tiny SVG building blocks
// ---------------------------------------------------------------------------

const mirrorX = (x) => W - x;

// Joins [x, y] pairs into an SVG path fragment ("x y L x y L ...").
const pts = (list) => list.map(([x, y]) => `${x} ${y}`).join(' L ');

// Garment body: flat colour, softened corners, then a light/shadow gradient on top.
function solid(d, color, shaded = true) {
    const base = `<path d="${d}" fill="${color}" stroke="${color}" stroke-width="8" stroke-linejoin="round"/>`;
    const shade = shaded
        ? `<path d="${d}" fill="url(#shade)" stroke="url(#shade)" stroke-width="8" stroke-linejoin="round"/>`
        : '';
    return base + shade;
}

// Plain filled path with no outline (details such as pockets or collars).
const fillPath = (d, fill, extra = '') => `<path d="${d}" fill="${fill}" ${extra}/>`;

// Stroked line/curve with round caps.
const strokePath = (d, stroke, width, extra = '') =>
    `<path d="${d}" fill="none" stroke="${stroke}" stroke-width="${width}" stroke-linecap="round" stroke-linejoin="round" ${extra}/>`;

// Dashed stitching line in the garment's stitch tone.
const seam = (d, p, width = 2.4) => strokePath(d, p.stitch, width, 'stroke-dasharray="8 7" opacity=".85"');

const circle = (cx, cy, r, fill, extra = '') => `<circle cx="${cx}" cy="${cy}" r="${r}" fill="${fill}" ${extra}/>`;

// Unit vector pointing from a to b.
function dir(a, b) {
    const dx = b[0] - a[0];
    const dy = b[1] - a[1];
    const len = Math.hypot(dx, dy) || 1;
    return [dx / len, dy / len];
}

// Moves point `a` by `d` pixels along unit vector `u`.
const step = (a, u, d) => [a[0] + u[0] * d, a[1] + u[1] * d];

// Draws left-side geometry, then the mirrored right side, via a callback that receives a
// "side" object (x-mapper + sign) so sleeves, cuffs and seams are written once.
function bothSides(fn) {
    return fn({ x: (v) => v, sign: 1 }) + fn({ x: mirrorX, sign: -1 });
}

// Rib lines (hem bands, cuffs, beanie cuffs): evenly spaced short vertical strokes.
function ribLines(x1, x2, y1, y2, gap, color) {
    let out = '';
    for (let x = x1 + gap / 2; x < x2; x += gap) {
        out += strokePath(`M ${x} ${y1} L ${x} ${y2}`, color, 1.6, 'opacity=".4"');
    }
    return out;
}

// ---------------------------------------------------------------------------
// Shared upper-body outline (tee / hoodie / shirt all start from this)
// ---------------------------------------------------------------------------

// Returns the key points of a top: shoulders, sleeve ends, armpit and hem for the left side.
function topPoints({ half, hem, long, neckX = 240, neckY = 118, shoulderY = 160, armpitY, sleeveEndY = 540 }) {
    const sx = CX - half - 28;
    const e1 = long ? [sx - 100, sleeveEndY] : [sx - 85, shoulderY + 135];
    const e2 = long ? [e1[0] + 62, e1[1] + 24] : [e1[0] + 72, e1[1] + 48];
    const armpit = [CX - half, armpitY ?? (long ? 310 : 290)];
    return {
        neck: [neckX, neckY],
        shoulder: [sx, shoulderY],
        e1,
        e2,
        armpit,
        hemLeft: [CX - half, hem]
    };
}

// Closed outline path for the body + both sleeves, ending with a caller-supplied neckline.
function topOutline(t, neckClose) {
    const left = [t.neck, t.shoulder, t.e1, t.e2, t.armpit, t.hemLeft];
    const right = left.slice().reverse().map(([x, y]) => [mirrorX(x), y]);
    return `M ${pts(left)} L ${pts(right)} ${neckClose}`;
}

// Hem stitch, armhole seams and sleeve-end stitching shared by every top.
function topSeams(t, p, hem) {
    let out = seam(`M ${t.armpit[0] + 10} ${hem - 18} L ${mirrorX(t.armpit[0]) - 10} ${hem - 18}`, p);
    out += bothSides(({ x }) => {
        const inward = dir(t.e1, t.shoulder);
        const a = step(t.e1, inward, 16);
        const b = step(t.e2, inward, 16);
        return seam(`M ${x(t.shoulder[0] + 14)} ${t.shoulder[1] + 16} Q ${x(t.armpit[0] - 6)} ${t.armpit[1] - 70} ${x(t.armpit[0])} ${t.armpit[1]}`, p)
            + seam(`M ${x(a[0])} ${a[1]} L ${x(b[0])} ${b[1]}`, p);
    });
    return out;
}

// ---------------------------------------------------------------------------
// Garments - each returns SVG markup drawn in the shared 600x750 space
// ---------------------------------------------------------------------------

// T-shirt family: crew, v-neck, pocket, boxy, cropped and long-sleeve variants.
function drawTee(p, style) {
    const vneck = style === 'vneck';
    const boxy = style === 'boxy';
    const cropped = style === 'cropped';
    const long = style === 'long';
    const half = boxy || cropped ? 160 : 138;
    const hem = cropped ? 520 : boxy ? 610 : 640;
    const t = topPoints({ half, hem, long });
    const neckClose = vneck ? 'L 300 226 L 240 118 Z' : 'Q 300 216 240 118 Z';

    let out = solid(topOutline(t, neckClose), p.base);
    out += topSeams(t, p, hem);

    if (vneck) {
        out += fillPath('M 240 118 Q 300 150 360 118 L 300 226 Z', p.darker, 'opacity=".85"');
        out += strokePath('M 240 118 L 300 226 L 360 118', p.dark, 14);
    } else {
        out += fillPath('M 240 118 Q 300 152 360 118 Q 300 216 240 118 Z', p.darker, 'opacity=".85"');
        out += strokePath('M 240 118 Q 300 216 360 118', p.dark, 16);
    }

    if (style === 'pocket') {
        out += fillPath('M 340 240 L 404 240 L 404 300 L 372 312 L 340 300 Z', p.dark, 'opacity=".55"');
        out += seam('M 346 246 L 398 246 L 398 296 L 372 306 L 346 296 Z', p, 2);
    }
    return out;
}

// Hoodie family: pullover with kangaroo pocket, zip-up, oversized and cropped.
function drawHoodie(p, style) {
    const zip = style === 'zip';
    const oversized = style === 'oversized';
    const cropped = style === 'cropped';
    const half = oversized ? 172 : 150;
    const hem = cropped ? 560 : 650;
    const t = topPoints({
        half, hem, long: true, neckX: 246, neckY: 140, shoulderY: 182, armpitY: 330, sleeveEndY: cropped ? 500 : 560
    });

    // Hood sits behind the body: outer dome, then the dark opening that the neckline reveals.
    let out = solid('M 222 148 C 200 52 250 14 300 14 C 350 14 400 52 378 148 Z', p.base);
    out += fillPath('M 246 140 C 238 84 264 58 300 58 C 336 58 362 84 354 140 Q 300 208 246 140 Z', p.darker);
    out += solid(topOutline(t, 'Q 300 208 246 140 Z'), p.base);
    out += strokePath('M 246 140 C 238 84 264 58 300 58 C 336 58 362 84 354 140', p.dark, 12);

    // Rib hem band and cuffs.
    const hemTop = hem - 46;
    out += fillPath(`M ${t.hemLeft[0]} ${hemTop} L ${mirrorX(t.hemLeft[0])} ${hemTop} L ${mirrorX(t.hemLeft[0])} ${hem} L ${t.hemLeft[0]} ${hem} Z`, p.dark);
    out += ribLines(t.hemLeft[0], mirrorX(t.hemLeft[0]), hemTop + 4, hem - 4, 14, p.darker);
    out += bothSides(({ x }) => {
        const up = dir(t.e1, t.shoulder);
        const a = step(t.e1, up, 34);
        const b = step(t.e2, up, 34);
        return fillPath(`M ${x(t.e1[0])} ${t.e1[1]} L ${x(t.e2[0])} ${t.e2[1]} L ${x(b[0])} ${b[1]} L ${x(a[0])} ${a[1]} Z`, p.dark);
    });
    out += seam(`M ${t.armpit[0] + 10} ${hemTop - 10} L ${mirrorX(t.armpit[0]) - 10} ${hemTop - 10}`, p);

    const drawcord = p.lum > 0.5 ? '#5d4d3f' : '#efe6d8';
    if (zip) {
        out += strokePath(`M 300 206 L 300 ${hemTop}`, p.darker, 6);
        out += strokePath(`M 300 206 L 300 ${hemTop}`, p.light, 3, 'stroke-dasharray="3 5"');
        out += fillPath('M 292 208 h 16 v 30 h -16 z', p.accent, 'opacity=".9"');
        out += bothSides(({ x }) => seam(`M ${x(204)} ${hemTop - 150} L ${x(228)} ${hemTop - 20}`, p));
    } else {
        const pocketTop = hemTop - 150;
        out += fillPath(`M 212 ${pocketTop} L 388 ${pocketTop} L 416 ${hemTop - 22} L 184 ${hemTop - 22} Z`, p.dark, 'opacity=".5"');
        out += seam(`M 218 ${pocketTop + 8} L 382 ${pocketTop + 8} L 408 ${hemTop - 30} L 192 ${hemTop - 30} Z`, p, 2);
    }
    out += strokePath('M 280 206 Q 274 252 278 300', drawcord, 5);
    out += strokePath('M 320 206 Q 326 252 322 300', drawcord, 5);
    out += circle(278, 306, 6, drawcord) + circle(322, 306, 6, drawcord);
    return out;
}

// Button-up shirt family: oxford, mandarin collar, camp collar (short sleeve) and work shirt.
function drawShirt(p, style) {
    const camp = style === 'camp';
    const mandarin = style === 'mandarin';
    const work = style === 'work';
    const hem = 645;
    const t = topPoints({
        half: 140, hem, long: !camp, neckX: 246, neckY: 128, shoulderY: 166, armpitY: 305, sleeveEndY: 540
    });
    const notchY = camp ? 262 : mandarin ? 150 : 200;
    const neckClose = mandarin ? 'Q 300 170 246 128 Z' : `L 300 ${notchY} L 246 128 Z`;

    let out = solid(topOutline(t, neckClose), p.base);
    out += topSeams(t, p, hem);

    // Placket and buttons.
    const plTop = mandarin ? 168 : notchY + 4;
    out += fillPath(`M 284 ${plTop} h 32 V ${hem - 4} h -32 Z`, p.dark, 'opacity=".35"');
    out += strokePath(`M 284 ${plTop} V ${hem - 8}`, p.stitch, 1.6, 'opacity=".6"');
    out += strokePath(`M 316 ${plTop} V ${hem - 8}`, p.stitch, 1.6, 'opacity=".6"');
    for (let y = plTop + 40; y < hem - 30; y += 68) {
        out += circle(300, y, 6, p.accent, 'opacity=".95"') + circle(300, y, 1.8, p.dark);
    }

    // Collar.
    if (mandarin) {
        out += fillPath('M 246 128 Q 300 170 354 128 L 354 106 Q 300 148 246 106 Z', p.dark);
        out += strokePath('M 246 128 Q 300 170 354 128', p.darker, 2);
    } else {
        const leaf = camp
            ? [[238, 104], [300, 262], [248, 286], [194, 152]]
            : [[240, 104], [302, 206], [262, 248], [212, 154]];
        out += fillPath('M 240 108 Q 300 140 360 108 L 360 124 Q 300 156 240 124 Z', p.darker);
        out += bothSides(({ x }) => {
            const l = leaf.map(([px, py]) => [x(px), py]);
            return fillPath(`M ${pts(l)} Z`, p.light, `stroke="${p.dark}" stroke-width="3" stroke-linejoin="round"`)
                + fillPath(`M ${pts(l)} Z`, 'url(#shade)', 'opacity=".5"');
        });
    }

    // Pocket(s).
    const pocket = (x0) => fillPath(`M ${x0} 292 h 64 v 62 l -32 12 l -32 -12 Z`, p.dark, 'opacity=".45"')
        + seam(`M ${x0 + 6} 298 h 52 v 52 l -26 9 l -26 -9 Z`, p, 2);
    out += pocket(342);
    if (work) out += pocket(194);

    // Cuffs on long sleeves.
    if (!camp) {
        out += bothSides(({ x }) => {
            const up = dir(t.e1, t.shoulder);
            const a = step(t.e1, up, 36);
            const b = step(t.e2, up, 36);
            const mid = step([(t.e1[0] + t.e2[0]) / 2, (t.e1[1] + t.e2[1]) / 2], up, 18);
            return fillPath(`M ${x(t.e1[0])} ${t.e1[1]} L ${x(t.e2[0])} ${t.e2[1]} L ${x(b[0])} ${b[1]} L ${x(a[0])} ${a[1]} Z`, p.dark)
                + circle(x(mid[0]), mid[1], 4, p.accent, 'opacity=".9"');
        });
    }
    return out;
}

// Trousers: jeans, cargo, wide-leg, chino, jogger and creased trousers.
function drawPants(p, style) {
    const jogger = style === 'jogger';
    const wide = style === 'wide';
    const cargo = style === 'cargo';
    const jeans = style === 'jeans';
    const trouser = style === 'trouser';
    const hemY = 690;
    const topY = 96;

    const lo = wide ? 108 : jogger ? 214 : 170;      // left outer hem x
    const li = wide ? 266 : jogger ? 286 : 276;      // left inner hem x
    const leftSide = jogger
        ? [[188, topY], [176, 330], [lo, hemY]]
        : [[188, topY], [lo, hemY]];
    const left = [...leftSide, [li, hemY], [CX, 330]];
    const right = leftSide.map(([x, y]) => [mirrorX(x), y]);
    const path = `M ${pts(left)} L ${pts([[mirrorX(li), hemY], ...right.slice().reverse()])} Z`;

    let out = solid(path, p.base);

    // Waistband, loops, button and fly.
    out += fillPath(`M 188 ${topY} L 412 ${topY} L 413 146 L 187 146 Z`, p.dark);
    [208, 292, 378].forEach(x => { out += fillPath(`M ${x} ${topY - 2} h 14 v 62 h -14 z`, p.darker, 'opacity=".55"'); });
    out += circle(300, 120, 7, p.accent, 'opacity=".95"');
    out += strokePath('M 300 146 L 300 296', p.stitch, 2, 'opacity=".7"');
    out += seam('M 300 146 Q 334 230 314 300', p, 2.2);

    // Front pockets.
    if (!jogger) {
        out += bothSides(({ x }) => seam(`M ${x(192)} 150 Q ${x(234)} 178 ${x(246)} 246`, p));
    } else {
        out += bothSides(({ x }) => seam(`M ${x(192)} 152 Q ${x(224)} 170 ${x(232)} 214`, p));
    }

    if (jeans) {
        out += bothSides(({ x }) => seam(`M ${x(204)} 168 Q ${x(222)} 188 ${x(236)} 186`, p, 2));
    }
    if (cargo) {
        out += bothSides(({ x }) => {
            const l = [[170, 390], [236, 390], [236, 486], [170, 486]].map(([px, py]) => [x(px), py]);
            return fillPath(`M ${pts(l)} Z`, p.dark, 'opacity=".5"')
                + seam(`M ${x(176)} 412 L ${x(230)} 412`, p, 2)
                + circle(x(203), 412, 4, p.accent, 'opacity=".9"');
        });
    }
    if (trouser) {
        out += bothSides(({ x }) => strokePath(`M ${x(232)} 160 L ${x(214)} 676`, p.darker, 2.4, 'opacity=".45"'));
        out += bothSides(({ x }) => strokePath(`M ${x(212)} 156 L ${x(224)} 190`, p.darker, 2.4, 'opacity=".4"'));
    }

    // Hems and cuffs.
    if (jogger) {
        out += bothSides(({ x }) => {
            const l = [[lo - 2, hemY - 44], [li + 2, hemY - 44], [li + 2, hemY], [lo - 2, hemY]].map(([px, py]) => [x(px), py]);
            return fillPath(`M ${pts(l)} Z`, p.dark) + ribLines(Math.min(x(lo - 2), x(li + 2)), Math.max(x(lo - 2), x(li + 2)), hemY - 40, hemY - 4, 12, p.darker);
        });
    } else {
        out += bothSides(({ x }) => seam(`M ${x(lo + 8)} ${hemY - 22} L ${x(li - 6)} ${hemY - 22}`, p));
    }
    return out;
}

// Dresses: slip (thin straps), sleeved, and belted.
function drawDress(p, style) {
    const sleeved = style === 'sleeved';
    const belted = style === 'belted';
    const strap = sleeved || belted ? 42 : 26;
    const left = 300 - 52 - strap;
    let out = '';

    if (sleeved) {
        out += bothSides(({ x }) => {
            const l = [[left + 6, 92], [168, 128], [124, 226], [190, 250], [230, 216]].map(([px, py]) => [x(px), py]);
            return solid(`M ${pts(l)} Z`, p.base);
        });
    }

    const outline = [
        `M ${left} 88 L ${left + strap} 88 Q 300 ${sleeved ? 150 : 168} ${mirrorX(left + strap)} 88 L ${mirrorX(left)} 88`,
        'L 372 214 L 384 340 L 508 698 Q 300 744 92 698 L 216 340 L 228 214 Z'
    ].join(' ');
    out += solid(outline, p.base);

    // Skirt pleats radiate from the waist to the hem.
    [250, 275, 300, 325, 350].forEach((wx, i) => {
        const hx = 150 + i * 75;
        out += strokePath(`M ${wx} 352 L ${hx} 704`, p.darker, 2.2, 'opacity=".28"');
    });

    if (belted) {
        out += fillPath('M 213 322 L 387 322 L 389 352 L 211 352 Z', p.dark);
        out += fillPath('M 284 320 h 32 v 34 h -32 z', 'none', `stroke="${p.accent}" stroke-width="5"`);
    } else {
        out += seam('M 218 340 L 382 340', p);
    }
    out += bothSides(({ x }) => seam(`M ${x(236)} 100 Q ${x(226)} 170 ${x(232)} 214`, p, 2));
    return out;
}

// Bags: tote, crossbody, backpack.
function drawBag(p, style) {
    const metal = '#c9a15a';
    let out = '';
    if (style === 'tote') {
        out += strokePath('M 210 312 C 210 120 390 120 390 312', p.dark, 18);
        out += strokePath('M 210 312 C 210 120 390 120 390 312', p.light, 4, 'opacity=".4"');
        out += solid('M 132 300 L 468 300 L 498 646 Q 500 672 474 672 L 126 672 Q 100 672 102 646 Z', p.base);
        out += fillPath('M 132 300 L 468 300 L 472 346 L 128 346 Z', p.dark, 'opacity=".7"');
        out += seam('M 140 360 L 460 360', p);
        out += fillPath('M 206 440 h 188 v 130 q 0 14 -14 14 h -160 q -14 0 -14 -14 Z', p.dark, 'opacity=".5"');
        out += seam('M 214 450 h 172 v 118 h -172 Z', p, 2);
        out += circle(300, 330, 7, p.accent, 'opacity=".9"');
    } else if (style === 'crossbody') {
        out += strokePath('M 168 372 C 110 120 490 120 432 372', p.dark, 22);
        out += solid('M 140 360 H 460 Q 484 360 484 384 V 598 Q 484 622 460 622 H 140 Q 116 622 116 598 V 384 Q 116 360 140 360 Z', p.base);
        out += solid('M 116 384 Q 116 360 140 360 H 460 Q 484 360 484 384 V 452 Q 300 528 116 452 Z', p.dark);
        out += seam('M 130 440 Q 300 510 470 440', p, 2);
        out += circle(300, 498, 17, metal, `stroke="${darken(metal, 0.3)}" stroke-width="3"`);
        out += circle(300, 498, 6, darken(metal, 0.25));
    } else {
        out += bothSides(({ x }) => strokePath(`M ${x(178)} 256 C ${x(112)} 360 ${x(112)} 520 ${x(168)} 640`, p.dark, 30));
        out += strokePath('M 256 196 C 256 130 344 130 344 196', p.dark, 16);
        out += solid('M 250 190 H 350 Q 440 190 440 290 V 590 Q 440 682 350 682 H 250 Q 160 682 160 590 V 290 Q 160 190 250 190 Z', p.base);
        out += fillPath('M 198 444 H 402 Q 414 444 414 456 V 600 Q 414 626 388 626 H 212 Q 186 626 186 600 V 456 Q 186 444 198 444 Z', p.dark, 'opacity=".55"');
        out += strokePath('M 204 482 H 396', p.darker, 4);
        out += fillPath('M 292 478 h 16 v 30 h -16 z', metal);
        out += seam('M 196 300 Q 300 330 404 300', p, 2);
    }
    return out;
}

// Accessories: cap, sunglasses (aviator / round), belt, beanie, watch (round / square).
function drawAccessory(p, style) {
    const metal = '#c9a15a';
    let out = '';

    if (style === 'cap') {
        // Side-view baseball cap: dome crown on the left, curved visor pointing right.
        out += solid('M 108 476 C 100 286 178 192 286 192 C 388 192 458 270 464 476 Z', p.base);
        out += strokePath('M 286 194 C 240 262 222 366 224 476', p.stitch, 2.4, 'opacity=".7"');
        out += strokePath('M 286 194 C 332 262 352 366 354 476', p.stitch, 2.4, 'opacity=".7"');
        out += strokePath('M 286 194 C 168 250 128 360 122 470', p.stitch, 2.4, 'opacity=".5"');
        out += circle(286, 194, 11, p.dark);
        out += fillPath('M 108 462 H 464 V 484 H 108 Z', p.dark);
        out += solid('M 328 474 C 436 440 528 452 580 506 C 548 532 440 530 328 504 Z', p.dark);
        out += strokePath('M 340 492 C 436 478 520 486 566 512', p.darker, 3, 'opacity=".5"');
        out += strokePath('M 108 484 Q 120 520 170 524', p.darker, 8, 'opacity=".7"');
    } else if (style === 'sunglasses' || style === 'roundglasses') {
        const lens = '#1f1c1b';
        const lensPath = style === 'sunglasses'
            ? 'M 92 330 Q 92 302 132 298 L 250 302 Q 282 306 274 384 Q 262 474 182 480 Q 102 482 92 402 Z'
            : null;
        const side = ({ x }) => {
            if (lensPath) {
                const d = x === mirrorX ? lensPath.replace(/(\d+) (\d+)/g, (_, a, b) => `${mirrorX(Number(a))} ${b}`) : lensPath;
                return `<path d="${d}" fill="${lens}" stroke="${p.base}" stroke-width="14" stroke-linejoin="round"/>`
                    + `<path d="${d}" fill="url(#shade)" opacity=".7"/>`;
            }
            return circle(x(182), 400, 88, lens, `stroke="${p.base}" stroke-width="14"`)
                + circle(x(182), 400, 88, 'url(#shade)', 'opacity=".7"');
        };
        out += bothSides(side);
        out += strokePath('M 272 336 Q 300 310 328 336', p.base, 11);
        out += strokePath('M 120 302 L 60 286', p.base, 12) + strokePath('M 480 302 L 540 286', p.base, 12);
        out += bothSides(({ x }) => strokePath(`M ${x(138)} 346 Q ${x(168)} 330 ${x(204)} 336`, '#ffffff', 5, 'opacity=".22"'));
    } else if (style === 'belt') {
        out += '<g transform="rotate(-7 300 375)">';
        out += solid('M 160 338 H 520 Q 548 338 548 374 Q 548 410 520 410 H 160 Z', p.base);
        out += seam('M 214 350 H 524', p, 2.2) + seam('M 214 398 H 524', p, 2.2);
        for (let x = 300; x <= 480; x += 45) out += circle(x, 374, 7, p.darker, 'opacity=".85"');
        out += fillPath('M 236 336 h 20 v 76 h -20 z', p.dark);
        out += fillPath('M 70 314 H 192 Q 210 314 210 332 V 416 Q 210 434 192 434 H 70 Q 52 434 52 416 V 332 Q 52 314 70 314 Z M 90 336 V 412 H 176 V 336 Z',
            metal, `fill-rule="evenodd" stroke="${darken(metal, 0.3)}" stroke-width="3"`);
        out += strokePath('M 98 374 L 270 374', metal, 8);
        out += '</g>';
    } else if (style === 'beanie') {
        out += solid('M 140 430 C 130 230 220 140 300 140 C 380 140 470 230 460 430 Z', p.base);
        for (let k = -3; k <= 3; k++) {
            out += strokePath(`M 300 150 Q ${300 + k * 32} 290 ${300 + k * 52} 430`, p.darker, 3, 'opacity=".25"');
        }
        out += solid('M 126 430 H 474 Q 492 430 492 448 V 522 Q 492 540 474 540 H 126 Q 108 540 108 522 V 448 Q 108 430 126 430 Z', p.dark);
        out += ribLines(112, 488, 440, 530, 16, p.darker);
    } else {
        // Watches: round or square case on a two-piece strap.
        const square = style === 'squarewatch';
        const caseColor = p.lum > 0.5 ? '#3a3633' : '#d8d0c4';
        const faceColor = p.lum > 0.5 ? '#2a2623' : '#f6f1e8';
        const ink = p.lum > 0.5 ? '#efe6d8' : '#2a2623';
        out += solid('M 252 36 L 348 36 L 364 290 L 236 290 Z', p.base);
        out += solid('M 236 460 L 364 460 L 348 714 L 252 714 Z', p.base);
        [550, 596, 642].forEach(y => { out += circle(300, y, 6, p.darker, 'opacity=".8"'); });
        out += seam('M 262 50 L 272 280', p, 2) + seam('M 338 50 L 328 280', p, 2);
        if (square) {
            out += `<rect x="176" y="250" width="248" height="250" rx="46" fill="${caseColor}" stroke="${darken(caseColor, 0.3)}" stroke-width="6"/>`;
            out += `<rect x="200" y="274" width="200" height="202" rx="30" fill="${faceColor}"/>`;
        } else {
            out += circle(300, 375, 124, caseColor, `stroke="${darken(caseColor, 0.3)}" stroke-width="6"`);
            out += circle(300, 375, 96, faceColor);
        }
        for (let i = 0; i < 12; i++) {
            const a = (i * Math.PI) / 6;
            const r1 = i % 3 === 0 ? 72 : 80;
            out += strokePath(`M ${300 + Math.sin(a) * r1} ${375 - Math.cos(a) * r1} L ${300 + Math.sin(a) * 88} ${375 - Math.cos(a) * 88}`, ink, i % 3 === 0 ? 4 : 2);
        }
        out += strokePath('M 300 375 L 300 316', ink, 6) + strokePath('M 300 375 L 346 352', ink, 4);
        out += circle(300, 375, 7, metal);
        out += `<rect x="${square ? 424 : 420}" y="358" width="20" height="34" rx="6" fill="${darken(caseColor, 0.2)}"/>`;
    }
    return out;
}

// Footwear in side profile (toe pointing right): sneaker, runner, hightop, boot, loafer.
function drawShoes(p, style) {
    const sole = '#f4efe6';
    const soleEdge = '#cfc3b0';
    const rubber = '#2b2623';
    const lace = p.lum > 0.55 ? darken(p.base, 0.4) : '#f4efe6';
    let out = '';

    if (style === 'boot') {
        // Chelsea boot: tall shaft with an elastic side panel and a stacked heel.
        out += solid('M 140 482 L 138 188 Q 138 168 160 168 L 292 168 Q 314 168 314 190 L 316 366 Q 386 392 454 418 Q 534 442 548 482 Z', p.base);
        out += fillPath('M 138 268 L 316 268 L 316 346 L 138 346 Z', p.darker, 'opacity=".45"');
        out += strokePath('M 138 346 L 316 346', p.stitch, 2.4, 'opacity=".7"');
        out += strokePath('M 160 170 Q 226 194 292 170', p.dark, 10);
        out += fillPath('M 214 188 h 20 v 40 h -20 z', p.accent, 'opacity=".85"');
        out += strokePath('M 400 414 Q 480 430 528 462', p.stitch, 2.4, 'stroke-dasharray="7 6" opacity=".8"');
        out += fillPath('M 122 476 H 556 Q 580 476 580 498 V 506 Q 580 526 556 526 H 142 Q 122 526 122 506 Z', rubber);
        out += fillPath('M 128 526 H 232 V 566 H 140 Q 128 566 128 554 Z', rubber);
        return out;
    }

    const high = style === 'hightop';
    const runner = style === 'runner';
    const loafer = style === 'loafer';
    const soleH = runner ? 58 : loafer ? 18 : 38;
    const soleFill = loafer ? rubber : sole;
    const soleStroke = loafer ? '#120f0e' : soleEdge;

    let upper;
    if (loafer) {
        upper = 'M 96 474 L 96 414 Q 96 394 122 392 L 196 394 Q 222 398 236 414 Q 262 434 304 424 Q 356 410 424 422 Q 534 440 552 474 Z';
    } else if (high) {
        upper = 'M 94 474 L 90 250 Q 92 226 120 226 L 160 228 Q 186 262 214 258 L 224 212 Q 246 204 256 226 L 268 372 Q 304 392 352 398 Q 432 404 492 424 Q 550 446 552 474 Z';
    } else {
        upper = 'M 94 474 L 92 338 Q 94 322 120 322 L 150 324 Q 172 352 200 346 L 214 312 Q 236 304 246 324 L 262 372 Q 302 392 352 398 Q 432 404 492 424 Q 550 446 552 474 Z';
    }

    // Sole first so the upper sits on top of it.
    out += `<path d="M 80 466 H 554 Q 580 466 580 490 V ${474 + soleH - 14} Q 580 ${474 + soleH} 556 ${474 + soleH} H 104 Q 80 ${474 + soleH} 80 ${474 + soleH - 14} Z" fill="${soleFill}" stroke="${soleStroke}" stroke-width="4" stroke-linejoin="round"/>`;
    if (!loafer) {
        out += strokePath(`M 96 ${474 + soleH - 12} H 566`, soleEdge, 3, 'stroke-dasharray="3 7" opacity=".85"');
    }
    if (runner) {
        out += strokePath('M 96 492 H 566', p.base, 6, 'opacity=".85"');
    }
    if (loafer) {
        out += fillPath('M 82 492 H 196 V 530 H 94 Q 82 530 82 518 Z', rubber);
    }

    out += solid(upper, p.base);

    if (loafer) {
        // Saddle strap, throat shadow and a visible stitch line.
        out += fillPath('M 304 410 L 398 416 L 398 454 L 304 446 Z', p.dark);
        out += fillPath('M 316 422 L 386 427 L 386 442 L 316 437 Z', p.darker, 'opacity=".55"');
        out += fillPath('M 198 394 Q 222 398 236 414 Q 262 434 304 424 L 304 440 Q 258 448 226 430 Q 206 414 198 394 Z', p.darker, 'opacity=".7"');
        out += strokePath('M 420 424 Q 500 436 536 462', p.stitch, 2.4, 'stroke-dasharray="7 6" opacity=".8"');
    } else {
        // Lace bars follow the opening: short and steep on a high-top, diagonal on a low-top.
        const laceStart = high ? [[258, 262], [260, 292], [262, 322], [265, 350], [296, 380]] : [[258, 346], [280, 366], [306, 380], [334, 389]];
        laceStart.forEach(([bx, by]) => {
            out += strokePath(`M ${bx - 14} ${by + 6} L ${bx + 12} ${by - 8}`, lace, 5);
        });
        out += strokePath('M 420 410 Q 492 420 530 452', p.stitch, 2.4, 'stroke-dasharray="7 6" opacity=".8"');
        out += strokePath(`M 150 448 Q 240 ${high ? 410 : 412} 344 436`, p.light, 10, 'opacity=".75"');
        out += fillPath(`M 94 ${high ? 270 : 350} L 94 ${high ? 346 : 420} L 138 ${high ? 346 : 420} L 134 ${high ? 232 : 326} Z`, p.dark, 'opacity=".75"');
    }
    return out;
}

// ---------------------------------------------------------------------------
// Scene composition
// ---------------------------------------------------------------------------

const DRAWERS = {
    tee: drawTee,
    hoodie: drawHoodie,
    shirt: drawShirt,
    pants: drawPants,
    dress: drawDress,
    bag: drawBag,
    accessory: drawAccessory,
    shoes: drawShoes
};

// "Detail" shot: same garment, zoomed on the part that matters for that product type.
const DETAIL_ZOOM = {
    tee: 'translate(-165 -75) scale(1.55)',
    hoodie: 'translate(-165 -45) scale(1.55)',
    shirt: 'translate(-165 -75) scale(1.55)',
    pants: 'translate(-165 -50) scale(1.55)',
    dress: 'translate(-135 -50) scale(1.45)',
    bag: 'translate(-110 -140) scale(1.37)',
    accessory: 'translate(-110 -140) scale(1.37)',
    shoes: 'translate(-90 -250) scale(1.28)'
};

// Vertical offset so low-profile items (shoes, belts, caps) sit visually centred.
const VERTICAL_NUDGE = { shoes: 'translate(0 -70)', accessory: 'translate(0 0)' };

// Shared SVG defs: garment shading gradient, drop shadow, and the studio backdrop.
function defs(bgInner, bgOuter) {
    return `<defs>
<linearGradient id="shade" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="#fff" stop-opacity=".17"/><stop offset=".5" stop-color="#fff" stop-opacity="0"/><stop offset="1" stop-color="#000" stop-opacity=".22"/></linearGradient>
<radialGradient id="bg" cx=".5" cy=".42" r=".78"><stop offset="0" stop-color="${bgInner}"/><stop offset="1" stop-color="${bgOuter}"/></radialGradient>
<filter id="drop" x="-20%" y="-20%" width="140%" height="150%"><feGaussianBlur in="SourceAlpha" stdDeviation="13"/><feOffset dy="16" result="b"/><feComponentTransfer><feFuncA type="linear" slope=".30"/></feComponentTransfer><feMerge><feMergeNode/><feMergeNode in="SourceGraphic"/></feMerge></filter>
</defs>`;
}

// Picks a backdrop that contrasts with the garment (light cloth on a deeper tone and vice versa).
function backdropTones(lum, view) {
    if (lum > 0.62) return view === 'detail' ? ['#bfa98f', '#a98f74'] : ['#c9b49b', '#b39b80'];
    return view === 'detail' ? ['#efe2d2', '#dcc8b2'] : ['#f4eadf', '#e3d2bf'];
}

// base64 data URI (ASCII-only SVG, so btoa is safe in browsers and Node).
function toDataUri(svg) {
    return `data:image/svg+xml;base64,${btoa(svg)}`;
}

const imageCache = new Map();

// One product photo. `view` is "front" or "detail".
export function productImage({ shape, style, hex, view = 'front' }) {
    const key = `${shape}|${style}|${hex}|${view}`;
    if (imageCache.has(key)) return imageCache.get(key);

    const draw = DRAWERS[shape] || drawTee;
    const p = palette(hex);
    const [inner, outer] = backdropTones(p.lum, view);
    const zoom = view === 'detail' ? DETAIL_ZOOM[shape] || '' : VERTICAL_NUDGE[shape] || '';

    const svg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${W} ${H}" width="${W}" height="${H}">${defs(inner, outer)}`
        + `<rect width="${W}" height="${H}" fill="url(#bg)"/>`
        + `<g transform="${zoom}"><g filter="url(#drop)">${draw(p, style)}</g></g></svg>`;

    const uri = toDataUri(svg);
    imageCache.set(key, uri);
    return uri;
}

// Representative item used for each category's round icon on the home page.
const CATEGORY_ICON_SPEC = {
    pants: { shape: 'pants', style: 'jeans', hex: '#6b7052' },
    't-shirts': { shape: 'tee', style: 'crew', hex: '#b56a4e' },
    hoodies: { shape: 'hoodie', style: 'pullover', hex: '#1a1a1a' },
    shirts: { shape: 'shirt', style: 'oxford', hex: '#d9c4a3' },
    dresses: { shape: 'dress', style: 'belted', hex: '#b56a4e' },
    bags: { shape: 'bag', style: 'tote', hex: '#6b7052' },
    accessories: { shape: 'accessory', style: 'cap', hex: '#1a1a1a' },
    shoes: { shape: 'shoes', style: 'sneaker', hex: '#d9c4a3' }
};

// Square icon (240x240) shown inside the round category buttons.
export function categoryIcon(slug) {
    const key = `icon|${slug}`;
    if (imageCache.has(key)) return imageCache.get(key);

    const spec = CATEGORY_ICON_SPEC[slug] || CATEGORY_ICON_SPEC.pants;
    const p = palette(spec.hex);
    const [inner, outer] = backdropTones(p.lum, 'front');
    const wide = spec.shape === 'shoes' || spec.shape === 'accessory';
    const scale = wide ? 0.4 : 0.32;
    const tx = 120 - CX * scale;
    const ty = (wide ? 108 : 124) - (wide ? 480 : 395) * scale;

    const svg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 240 240" width="240" height="240">${defs(inner, outer)}`
        + `<rect width="240" height="240" fill="url(#bg)"/>`
        + `<g transform="translate(${tx} ${ty}) scale(${scale})"><g filter="url(#drop)">${DRAWERS[spec.shape](p, spec.style)}</g></g></svg>`;

    const uri = toDataUri(svg);
    imageCache.set(key, uri);
    return uri;
}

// Turns a short "art:" URL stored in the demo catalog into the actual image (a data URI).
// Keeping the catalog and the guest cart / recently-viewed lists on short URLs (instead of
// ~10 KB data URIs) keeps localStorage small and mirrors how a real backend returns URLs.
//   art:product/<shape>/<style>/<hex without #>/<front|detail>
//   art:icon/<category-slug>
export function resolveArtUrl(url) {
    const [kind, ...rest] = url.slice('art:'.length).split('/');
    if (kind === 'product') {
        const [shape, style, hex, view] = rest;
        return productImage({ shape, style, hex: `#${hex}`, view: view || 'front' });
    }
    if (kind === 'icon') return categoryIcon(rest[0]);
    return '';
}
