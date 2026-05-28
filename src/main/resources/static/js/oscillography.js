// ============================================================
//  BOTTINO MONITORING — Oscillography Module v2.0
//  COMTRADE IEEE C37.111 (Rev 1991 / 1999 / 2013)
//
//  VALIDATED against: Substation / PowerLogicP5 / 2013
//    - 6 analog (IA,IB,IC,VA,VB,VC) + 2 digital (I>1 s, I>1 t)
//    - 16368 samples @ 2400 Hz (48 samples/cycle, 50Hz)
//    - 6820.6 ms total duration  |  ASCII format
//    - physical = raw * a  (b=0; 'a' already encodes secondary value)
//    - VA RMS ≈ 13.19 kV → 13.2 kV system confirmed
// ============================================================

'use strict';

// ============================================================
//  LAYER 1 — COMTRADE PARSER
// ============================================================
var ComtradeParser = (function () {

    function parseCfg(text) {
        var lines = text.replace(/\r\n/g, '\n').replace(/\r/g, '\n')
                        .split('\n').filter(function(l){ return l.trim() !== ''; });
        var i = 0;

        // Line 1: station_name, rec_dev_id[, rev_year]
        var l1 = lines[i++].split(',');
        var header = {
            stationName: (l1[0]||'').trim(),
            deviceId:    (l1[1]||'').trim(),
            revision:    (l1[2]||'1991').trim(),
        };

        // Line 2: TT,nAA,nDD
        var l2 = lines[i++].split(',');
        var nA = parseInt((l2[1]||'0').replace(/\D/g,''), 10);
        var nD = parseInt((l2[2]||'0').replace(/\D/g,''), 10);

        // Analog channels
        var analogChannels = [];
        for (var ai = 0; ai < nA; ai++) {
            var p = lines[i++].split(',');
            analogChannels.push({
                index:     parseInt(p[0],10),
                name:      (p[1]||'CH'+(ai+1)).trim(),
                phase:     (p[2]||'').trim(),
                ccbm:      (p[3]||'').trim(),
                unit:      (p[4]||'').trim(),
                a:         parseFloat(p[5]||'1'),
                b:         parseFloat(p[6]||'0'),
                skew:      parseFloat(p[7]||'0'),
                min:       parseInt(p[8]||'-99999',10),
                max:       parseInt(p[9]||'99998',10),
                primary:   parseFloat(p[10]||'1'),
                secondary: parseFloat(p[11]||'1'),
                ps:        (p[12]||'P').trim(),
            });
        }

        // Digital channels
        var digitalChannels = [];
        for (var di = 0; di < nD; di++) {
            var d = lines[i++].split(',');
            digitalChannels.push({
                index:       parseInt(d[0],10),
                name:        (d[1]||'D'+(di+1)).trim(),
                phase:       (d[2]||'').trim(),
                ccbm:        (d[3]||'').trim(),
                normalState: parseInt(d[4]||'0',10),
            });
        }

        // Nominal frequency
        var nomFreq = parseFloat(lines[i++]) || 50.0;

        // Sampling rates
        var nRates = parseInt(lines[i++],10) || 1;
        var sampleRates = [];
        for (var ri = 0; ri < nRates; ri++) {
            var sr = lines[i++].split(',');
            sampleRates.push({ samp: parseFloat(sr[0]||'0'), endSamp: parseInt(sr[1]||'0',10) });
        }
        var totalSamples = sampleRates[sampleRates.length-1].endSamp;

        // Timestamps
        var tsFirst   = parseTimestamp(lines[i++] || '');
        var tsTrigger = parseTimestamp(lines[i++] || '');

        // Data format
        var dataFormat = (lines[i++] || 'ASCII').trim().toUpperCase();

        // Time multiplier (optional, Rev 1999+)
        var timeMult = 1.0;
        if (i < lines.length) {
            var tm = parseFloat(lines[i++]);
            if (!isNaN(tm) && tm > 0) timeMult = tm;
        }

        return {
            header: header, nA: nA, nD: nD,
            analogChannels: analogChannels, digitalChannels: digitalChannels,
            nomFreq: nomFreq, sampleRates: sampleRates, totalSamples: totalSamples,
            tsFirst: tsFirst, tsTrigger: tsTrigger, dataFormat: dataFormat, timeMult: timeMult,
        };
    }

    function parseTimestamp(str) {
        if (!str) return null;
        var m = str.trim().match(/(\d{1,2})\/(\d{1,2})\/(\d{4}),(\d{2}):(\d{2}):(\d{2})\.?(\d*)/);
        if (!m) return null;
        var usStr = (m[7] || '000000').padEnd ? (m[7]||'').padEnd(6,'0').slice(0,6) : (m[7]||'000000').substr(0,6);
        return { raw:str.trim(), day:+m[1], mon:+m[2], year:+m[3], h:+m[4], min:+m[5], sec:+m[6], us:+usStr };
    }

    // Compute ms offset between trigger and first timestamp
    function triggerOffsetMs(cfg) {
        var t1 = cfg.tsFirst, t2 = cfg.tsTrigger;
        if (!t1 || !t2) return null;
        var ms = (t2.h  -t1.h )*3600000 + (t2.min-t1.min)*60000 +
                 (t2.sec-t1.sec)*1000   + (t2.us -t1.us )/1000;
        return ms;
    }

    // Parse ASCII .dat — returns typed arrays for performance
    function parseDatAscii(text, cfg) {
        var rows = text.replace(/\r\n/g,'\n').replace(/\r/g,'\n').split('\n');
        var N    = cfg.totalSamples;
        var nA   = cfg.nA, nD = cfg.nD;
        var ts   = new Float64Array(N);
        var aRaw = [];
        for (var a=0; a<nA; a++) aRaw.push(new Int32Array(N));
        var dRaw = [];
        for (var d=0; d<nD; d++) dRaw.push(new Uint8Array(N));

        var s = 0;
        for (var r = 0; r < rows.length && s < N; r++) {
            var row = rows[r].trim();
            if (!row) continue;
            var p = row.split(',');
            if (p.length < 2+nA+nD) continue;
            ts[s] = parseInt(p[1],10) * cfg.timeMult;
            for (var ai=0; ai<nA; ai++) aRaw[ai][s] = parseInt(p[2+ai], 10);
            for (var di=0; di<nD; di++) dRaw[di][s] = parseInt(p[2+nA+di], 10) & 1;
            s++;
        }
        return { ts: ts, aRaw: aRaw, dRaw: dRaw, n: s };
    }

    // Parse Binary .dat (16-bit signed, IEEE C37.111 standard)
    function parseDatBinary(buffer, cfg) {
        var nA    = cfg.nA, nD = cfg.nD;
        var dWds  = Math.ceil(nD/16);
        var bps   = 4 + 4 + nA*2 + dWds*2; // bytes per sample
        var N     = Math.min(cfg.totalSamples, Math.floor(buffer.byteLength/bps));
        var ts    = new Float64Array(N);
        var aRaw  = [];
        for (var a=0; a<nA; a++) aRaw.push(new Int32Array(N));
        var dRaw  = [];
        for (var d=0; d<nD; d++) dRaw.push(new Uint8Array(N));
        var view  = new DataView(buffer), off = 0;
        for (var s=0; s<N; s++) {
            off += 4; // seq
            ts[s] = view.getUint32(off,true)*cfg.timeMult; off+=4;
            for (var ai=0; ai<nA; ai++) { aRaw[ai][s]=view.getInt16(off,true); off+=2; }
            for (var dw=0; dw<dWds; dw++) {
                var w = view.getUint16(off,true); off+=2;
                for (var b=0; b<16 && (dw*16+b)<nD; b++) dRaw[dw*16+b][s]=(w>>b)&1;
            }
        }
        return { ts:ts, aRaw:aRaw, dRaw:dRaw, n:N };
    }

    // Validate cross-consistency CFG ↔ DAT
    function validate(cfg, dat) {
        var errors=[], warnings=[];
        if (dat.n !== cfg.totalSamples) warnings.push('Muestras: DAT='+dat.n+' CFG='+cfg.totalSamples);
        if (dat.aRaw.length !== cfg.nA) errors.push('Canales A: DAT='+dat.aRaw.length+' CFG='+cfg.nA);
        if (dat.dRaw.length !== cfg.nD) errors.push('Canales D: DAT='+dat.dRaw.length+' CFG='+cfg.nD);
        return { ok: errors.length===0, errors:errors, warnings:warnings };
    }

    return { parseCfg:parseCfg, parseDatAscii:parseDatAscii, parseDatBinary:parseDatBinary,
             validate:validate, triggerOffsetMs:triggerOffsetMs };
})();


// ============================================================
//  LAYER 2 — NORMALIZER  raw → physical (SI units)
//
//  KEY FINDING from real file analysis:
//  The PowerLogicP5 embeds the instrument transformer ratio
//  inside the 'a' factor.  Formula: physical = raw * a + b
//  No additional (primary/secondary) scaling is needed.
//  Verified: VA_RMS = 13.19 kV for a nominal 13.2 kV system.
// ============================================================
var ComtradeNorm = (function () {

    var COLORS_A = ['#00d4ff','#ff6b6b','#51cf66','#ffd43b','#74c0fc','#f783ac'];
    var COLORS_V = ['#74c0fc','#f783ac','#a9e34b','#ffe066','#00d4ff','#ff6b6b'];
    var COLORS_D = ['#ffe066','#ff9f43','#ee5a24','#a29bfe'];

    function pickColor(name, unit, idx) {
        var n = name.toUpperCase();
        if (unit === 'A') {
            if (n.includes('A')) return '#00d4ff';
            if (n.includes('B')) return '#ff6b6b';
            if (n.includes('C')) return '#51cf66';
            return COLORS_A[idx % COLORS_A.length];
        }
        if (unit === 'V') {
            if (n.includes('A')) return '#74c0fc';
            if (n.includes('B')) return '#f783ac';
            if (n.includes('C')) return '#a9e34b';
            return COLORS_V[idx % COLORS_V.length];
        }
        return COLORS_A[idx % COLORS_A.length];
    }

    function buildAnalog(cfg, dat) {
        var result = [];
        for (var i=0; i<cfg.nA; i++) {
            var ch  = cfg.analogChannels[i];
            var raw = dat.aRaw[i];
            var a = ch.a, b = ch.b, n = dat.n;
            var phys = new Float32Array(n);
            for (var s=0; s<n; s++) phys[s] = raw[s]*a + b;

            // Compute peak for auto-scale
            var peak = 0;
            for (var s=0; s<n; s++) { var av=Math.abs(phys[s]); if(av>peak) peak=av; }

            result.push({
                type:'analog', index:ch.index, name:ch.name, unit:ch.unit,
                phase:ch.phase, primary:ch.primary, secondary:ch.secondary,
                data:phys, peak:peak||1,
                color: pickColor(ch.name, ch.unit, i),
                visible:true,
            });
        }

        // ── Shared-scale: all channels of same unit share the same groupPeak ──
        // This way if IA=400A and IB=100A, IB visually appears 4x smaller
        var groupPeaks = {};
        result.forEach(function(ch) {
            var u = ch.unit || '_';
            if (!groupPeaks[u] || ch.peak > groupPeaks[u]) groupPeaks[u] = ch.peak;
        });
        result.forEach(function(ch) {
            ch.groupPeak = groupPeaks[ch.unit || '_'] || ch.peak;
        });

        return result;
    }

    function buildDigital(cfg, dat) {
        var result = [];
        for (var i=0; i<cfg.nD; i++) {
            var ch = cfg.digitalChannels[i];
            result.push({
                type:'digital', index:ch.index, name:ch.name, normalState:ch.normalState,
                data: dat.dRaw[i],
                color: COLORS_D[i % COLORS_D.length],
                visible:true,
            });
        }
        return result;
    }

    return { buildAnalog:buildAnalog, buildDigital:buildDigital };
})();


// ============================================================
//  LAYER 3 — ELECTRICAL ANALYZER
// ============================================================
var ElecAnalyzer = (function () {

    function rmsWindow(data, start, count) {
        var sum=0, n=Math.min(count, data.length-start);
        if (n<=0) return 0;
        for (var i=start; i<start+n; i++) sum += data[i]*data[i];
        return Math.sqrt(sum/n);
    }

    function estimateSR(ts, n) {
        var count = Math.min(500, n-1), sum=0;
        for (var i=0; i<count; i++) sum += ts[i+1]-ts[i];
        return sum>0 ? Math.round(1e6/(sum/count)) : 0;
    }

    function run(cfg, ts, analogChs, digitalChs) {
        var n   = ts.length;
        var sr  = estimateSR(ts, n);
        var spc = Math.round(sr/cfg.nomFreq);  // samples per cycle
        var trigMs = ComtradeParser.triggerOffsetMs(cfg);

        var events = [];

        // ── 1. Signal onset (first non-zero sample) ──────────────────
        var onset = findOnset(ts, analogChs);
        if (onset) events.push(onset);

        // ── 2. Overcurrent detection ──────────────────────────────────
        analogChs.forEach(function(ch) {
            if (ch.unit !== 'A') return;
            // Compute pre-onset steady state — for this recording it's 0A (de-energized)
            // Use first non-zero window after onset for nominal
            var ref = 0;
            for (var i=spc; i+spc<n; i+=spc) {
                var r = rmsWindow(ch.data, i, spc);
                if (r > 1) { ref = r; break; }
            }
            if (ref < 1) return;
            var thresh = ref * 1.5 * Math.SQRT2;
            var inEv = false;
            for (var s=0; s<n; s++) {
                var v = Math.abs(ch.data[s]);
                if (v > thresh && !inEv) {
                    inEv = true;
                    events.push({ type:'overcurrent', color:'#ff6b6b',
                        label:'⚠ Sobreintensidad '+ch.name,
                        tMs:ts[s]/1000,
                        detail: ch.name+' = '+v.toFixed(1)+'A ('+(v/ref/Math.SQRT2*100).toFixed(0)+'% de nominal RMS)' });
                } else if (v < thresh*0.85) inEv=false;
            }
        });

        // ── 3. Digital transitions ────────────────────────────────────
        digitalChs.forEach(function(ch) {
            var prev = ch.data[0];
            for (var s=1; s<n; s++) {
                var cur = ch.data[s];
                if (cur !== prev) {
                    var rising = cur===1;
                    events.push({ type:'digital', color: rising ? '#ffe066' : '#aaa',
                        label: (rising?'▲ ':'▼ ') + ch.name + (rising?' activado':' reset'),
                        tMs: ts[s]/1000,
                        detail: '"'+ch.name+'" → '+cur+' en t='+( ts[s]/1000).toFixed(3)+'ms' });
                    prev = cur;
                }
            }
        });

        // ── 4. Trigger marker ─────────────────────────────────────────
        if (trigMs !== null) {
            events.push({ type:'trigger', color:'#ff4757',
                label:'📌 Trigger',
                tMs: trigMs,
                detail:'Punto de disparo COMTRADE — configurado en '+cfg.tsTrigger.raw });
        }

        events.sort(function(a,b){ return a.tMs-b.tMs; });

        // ── 5. Cycle-by-cycle RMS ─────────────────────────────────────
        var rmsTable = [];
        analogChs.forEach(function(ch) {
            var cycles=[], idx=0;
            while (idx+spc <= n) {
                cycles.push({ tMs:ts[idx]/1000, rms:rmsWindow(ch.data,idx,spc) });
                idx += spc;
            }
            var vals = cycles.map(function(c){return c.rms;});
            var nonzero = vals.filter(function(v){return v>0.1;});
            rmsTable.push({
                name: ch.name, unit:ch.unit, color:ch.color, cycles:cycles,
                min: nonzero.length ? Math.min.apply(null,nonzero) : 0,
                max: nonzero.length ? Math.max.apply(null,nonzero) : 0,
                avg: nonzero.length ? nonzero.reduce(function(a,b){return a+b;},0)/nonzero.length : 0,
            });
        });

        return { sr:sr, spc:spc, trigMs:trigMs, events:events, rms:rmsTable,
                 totalDurMs: ts[n-1]/1000 };
    }

    function findOnset(ts, analogChs) {
        var threshold = 0.5;
        for (var s=1; s<ts.length; s++) {
            for (var c=0; c<analogChs.length; c++) {
                if (Math.abs(analogChs[c].data[s])   > threshold &&
                    Math.abs(analogChs[c].data[s-1]) <= threshold) {
                    return { type:'onset', color:'#51cf66',
                        label:'⚡ Inicio de señal',
                        tMs: ts[s]/1000,
                        detail:'Primera muestra no nula detectada en canal '+analogChs[c].name };
                }
            }
        }
        return null;
    }

    // Cooley-Tukey FFT + Hann window
    function computeFFT(data, startIdx, size) {
        var N = 1;
        while (N < (size||1024)) N <<= 1;
        var re = new Float64Array(N), im = new Float64Array(N);
        for (var i=0; i<N; i++) {
            var w = 0.5*(1-Math.cos(2*Math.PI*i/(N-1)));
            re[i] = (startIdx+i < data.length) ? data[startIdx+i]*w : 0;
        }
        _fft(re, im, N);
        var mag = new Float32Array(N/2);
        var sc  = 2.0/N;
        for (var i=0; i<N/2; i++) mag[i] = Math.sqrt(re[i]*re[i]+im[i]*im[i])*sc;
        return mag;
    }
    function _fft(re, im, N) {
        var j=0;
        for (var i=1; i<N; i++) {
            var bit=N>>1;
            for(; j&bit; bit>>=1) j^=bit;
            j^=bit;
            if(i<j){ var t=re[i];re[i]=re[j];re[j]=t; t=im[i];im[i]=im[j];im[j]=t; }
        }
        for (var len=2; len<=N; len<<=1) {
            var ang=-2*Math.PI/len, wr=Math.cos(ang), wi=Math.sin(ang);
            for (var i=0; i<N; i+=len) {
                var cr=1, ci=0;
                for (var k=0; k<len/2; k++) {
                    var ur=re[i+k], ui=im[i+k];
                    var vr=re[i+k+len/2]*cr-im[i+k+len/2]*ci;
                    var vi=re[i+k+len/2]*ci+im[i+k+len/2]*cr;
                    re[i+k]=ur+vr; im[i+k]=ui+vi;
                    re[i+k+len/2]=ur-vr; im[i+k+len/2]=ui-vi;
                    var nr=cr*wr-ci*wi; ci=cr*wi+ci*wr; cr=nr;
                }
            }
        }
    }

    return { run:run, computeFFT:computeFFT, rmsWindow:rmsWindow, estimateSR:estimateSR };
})();


// ============================================================
//  LAYER 4 — RENDERER  (Canvas 2D, dark oscilloscope aesthetic)
// ============================================================
var OscRender = (function () {

    var THEME = {
        bg:          '#0d1117',
        grid:        'rgba(44,68,98,0.7)',
        gridMinor:   'rgba(24,38,55,0.8)',
        axis:        '#2d4460',
        label:       '#4a6a88',
        labelBright: '#7a9fc0',
        cursor:      'rgba(255,255,255,0.65)',
        trigLine:    '#ff4757',
    };

    var CH_H  = { analog:110, digital:32, pad:6 };
    var LEFT  = 70;  // label margin

    // Main render entry
    function render(ctx, st) {
        var W = ctx.canvas.width, H = ctx.canvas.height;
        ctx.clearRect(0,0,W,H);
        ctx.fillStyle = THEME.bg;
        ctx.fillRect(0,0,W,H);
        if (!st || !st.channels || !st.channels.length) return;

        var layout = buildLayout(st, H);
        drawGrid(ctx, st, layout, W);
        st.channels.forEach(function(ch,i) {
            if (!ch.visible) return;
            var row = layout.rows[i];
            drawChannelBg(ctx, row, LEFT, W);
            if (ch.type==='digital') drawDigital(ctx, st, ch, row);
            else drawAnalog(ctx, st, ch, row);
        });
        drawEventLines(ctx, st, layout);
        drawTrigger(ctx, st, layout);
        if (st.cursorX !== null) drawCursor(ctx, st, layout, H);
        drawLabels(ctx, st.channels, layout);
    }

    function buildLayout(st, H) {
        var rows=[], y=10;
        st.channels.forEach(function(ch) {
            var h = ch.type==='digital' ? CH_H.digital : CH_H.analog;
            rows.push({ y:y, h:h, mid:y+h/2 });
            if (ch.visible) y += h + CH_H.pad;
        });
        // Add bottom padding so the last channel is never clipped
        return { rows:rows, totalH:y + 24 };
    }

    function tToX(tMs, st, W) {
        var frac = (tMs - st.viewStart) / (st.viewEnd - st.viewStart);
        return LEFT + frac*(W - LEFT - 10);
    }

    function drawGrid(ctx, st, layout, W) {
        var dur   = st.viewEnd - st.viewStart;
        var step  = niceStep(dur/8);
        var t0    = Math.ceil(st.viewStart/step)*step;
        ctx.font  = '9px "Courier New",monospace';

        for (var t=t0; t<=st.viewEnd; t+=step) {
            var x = tToX(t, st, W);
            if (x < LEFT || x > W-10) continue;
            ctx.strokeStyle = THEME.grid;
            ctx.lineWidth   = 0.5;
            ctx.beginPath(); ctx.moveTo(x,10); ctx.lineTo(x, layout.totalH); ctx.stroke();
            ctx.fillStyle   = THEME.label;
            ctx.textAlign   = 'center';
            ctx.fillText(fmtTime(t), x, layout.totalH+13);
        }
    }

    function drawChannelBg(ctx, row, left, W) {
        ctx.fillStyle = 'rgba(255,255,255,0.012)';
        ctx.fillRect(left, row.y, W-left-10, row.h);
        ctx.strokeStyle = THEME.gridMinor;
        ctx.lineWidth   = 0.5;
        ctx.beginPath(); ctx.moveTo(left,row.mid); ctx.lineTo(W-10,row.mid); ctx.stroke();
    }

    function drawAnalog(ctx, st, ch, row) {
        var data = ch.data, ts = st.ts, n = data.length;
        var W    = ctx.canvas.width;
        var half = (row.h/2 - 6);
        var i0   = Math.max(0, binSearch(ts, st.viewStart*1000) - 1);
        var i1   = Math.min(n-1, binSearch(ts, st.viewEnd*1000) + 1);

        // Use groupPeak (shared across same-unit channels) so relative amplitudes are preserved
        var scale = ch.groupPeak || ch.peak || 1;

        ctx.save();
        ctx.beginPath();
        ctx.rect(LEFT, row.y, W-LEFT-10, row.h);
        ctx.clip();

        ctx.strokeStyle = ch.color;
        ctx.lineWidth   = 1.4;
        ctx.beginPath();
        var first = true;
        for (var i=i0; i<=i1; i++) {
            var x = tToX(ts[i]/1000, st, W);
            var y = row.mid - (data[i]/scale)*half;
            if (first) { ctx.moveTo(x,y); first=false; }
            else ctx.lineTo(x,y);
        }
        ctx.stroke();
        ctx.restore();
    }

    function drawDigital(ctx, st, ch, row) {
        var data = ch.data, ts = st.ts, n = data.length;
        var W    = ctx.canvas.width;
        var hi   = row.y + 5, lo = row.y + row.h - 5;
        var i0   = Math.max(0, binSearch(ts, st.viewStart*1000)-1);
        var i1   = Math.min(n-1, binSearch(ts, st.viewEnd*1000)+1);

        ctx.strokeStyle = ch.color;
        ctx.lineWidth   = 1.5;
        ctx.beginPath();
        var prevVal = null;
        for (var i=i0; i<=i1; i++) {
            var x = tToX(ts[i]/1000, st, W);
            var v = data[i], y = v ? hi : lo;
            if (prevVal===null) { ctx.moveTo(x,y); }
            else {
                if (v!==prevVal) { ctx.lineTo(x, prevVal?hi:lo); ctx.lineTo(x,y); }
                else ctx.lineTo(x,y);
            }
            prevVal = v;
        }
        ctx.stroke();
    }

    function drawEventLines(ctx, st, layout) {
        if (!st.events) return;
        var W = ctx.canvas.width;
        ctx.font = '9px monospace';
        st.events.forEach(function(ev) {
            if (ev.tMs<st.viewStart || ev.tMs>st.viewEnd) return;
            var x = tToX(ev.tMs, st, W);
            ctx.strokeStyle = ev.color+'aa';
            ctx.lineWidth   = 1;
            ctx.setLineDash([3,3]);
            ctx.beginPath(); ctx.moveTo(x,10); ctx.lineTo(x,layout.totalH); ctx.stroke();
            ctx.setLineDash([]);
        });
    }

    function drawTrigger(ctx, st, layout) {
        if (st.trigMs===null) return;
        if (st.trigMs<st.viewStart || st.trigMs>st.viewEnd) return;
        var W = ctx.canvas.width;
        var x = tToX(st.trigMs, st, W);
        ctx.strokeStyle = THEME.trigLine;
        ctx.lineWidth   = 1.5;
        ctx.beginPath(); ctx.moveTo(x,10); ctx.lineTo(x,layout.totalH); ctx.stroke();
        ctx.fillStyle   = THEME.trigLine;
        ctx.font        = 'bold 10px monospace';
        ctx.textAlign   = 'center';
        ctx.fillText('T',x,8);
    }

    function drawCursor(ctx, st, layout, H) {
        var W = ctx.canvas.width;
        var x = st.cursorX;
        if (x<LEFT||x>W-10) return;
        ctx.strokeStyle = THEME.cursor;
        ctx.lineWidth   = 1;
        ctx.setLineDash([4,3]);
        ctx.beginPath(); ctx.moveTo(x,10); ctx.lineTo(x,layout.totalH); ctx.stroke();
        ctx.setLineDash([]);
    }

    function drawLabels(ctx, channels, layout) {
        ctx.textAlign = 'right';
        channels.forEach(function(ch,i) {
            var row = layout.rows[i];
            if (!ch.visible) return;
            ctx.fillStyle = ch.color;
            ctx.font      = 'bold 10px "JetBrains Mono","Courier New",monospace';
            ctx.fillText(ch.name, LEFT-4, row.mid - (ch.unit?5:2));
            if (ch.unit) {
                // Show the actual peak value so user can see relative amplitudes
                var isV = ch.unit==='V';
                var scale = isV ? 1/1000 : 1;
                var unit  = isV ? 'kV' : 'A';
                var peakVal = (ch.peak * scale).toFixed(isV ? 1 : 0);
                ctx.fillStyle = THEME.labelBright;
                ctx.font      = '8px "JetBrains Mono","Courier New",monospace';
                ctx.fillText(peakVal+unit, LEFT-4, row.mid+7);
                // Show shared scale indicator if this channel is not the group leader
                if (ch.groupPeak && ch.groupPeak > ch.peak) {
                    ctx.fillStyle = 'rgba(255,160,0,0.6)';
                    ctx.font      = '7px monospace';
                    ctx.fillText('÷'+((ch.groupPeak/ch.peak)).toFixed(1)+'x', LEFT-4, row.mid+16);
                }
            }
        });
    }

    // FFT spectrum renderer — upgraded professional version
    function renderFFT(ctx, mag, sr, chName, unit) {
        var W=ctx.canvas.width, H=ctx.canvas.height;
        var pL=62,pR=20,pT=36,pB=44;
        var pw=W-pL-pR, ph=H-pT-pB;
        var nyq=sr/2, bins=mag.length;

        // Background with subtle gradient
        var bgGrad = ctx.createLinearGradient(0,0,0,H);
        bgGrad.addColorStop(0,'#080e18'); bgGrad.addColorStop(1,'#04080f');
        ctx.fillStyle=bgGrad; ctx.fillRect(0,0,W,H);
        ctx.strokeStyle='rgba(0,136,204,0.06)'; ctx.lineWidth=1;
        ctx.strokeRect(pL,pT,pw,ph);

        // Convert to dB scale
        var maxM=0; for(var i=1;i<bins;i++) if(mag[i]>maxM) maxM=mag[i];
        if(maxM<1e-9) maxM=1;
        function toDb(v){ return v>0 ? 20*Math.log10(v/maxM) : -80; }

        // Horizontal grid lines (dB)
        var dbLevels=[-60,-48,-36,-24,-12,0];
        ctx.font='9px JetBrains Mono,monospace'; ctx.textAlign='right';
        dbLevels.forEach(function(db){
            var gy=pT+ph*(1-((db+80)/80));
            if(gy<pT||gy>pT+ph) return;
            var alpha=db===0?0.2:0.08;
            ctx.strokeStyle='rgba(0,136,204,'+alpha+')'; ctx.lineWidth=0.8;
            ctx.beginPath(); ctx.moveTo(pL,gy); ctx.lineTo(pL+pw,gy); ctx.stroke();
            ctx.fillStyle=db===0?'rgba(0,212,255,0.5)':'rgba(60,100,140,0.6)';
            ctx.fillText(db+'dB', pL-6, gy+3);
        });

        // Vertical freq gridlines
        var freqStep = nyq>600?100:50;
        ctx.font='9px JetBrains Mono,monospace'; ctx.textAlign='center';
        for(var f=0; f<=nyq; f+=freqStep){
            var fx=pL+(f/nyq)*pw;
            ctx.strokeStyle='rgba(0,136,204,0.07)'; ctx.lineWidth=0.6;
            ctx.beginPath(); ctx.moveTo(fx,pT); ctx.lineTo(fx,pT+ph); ctx.stroke();
            if(f>0){
                ctx.fillStyle='rgba(60,100,140,0.7)';
                ctx.fillText(f+'Hz', fx, pT+ph+14);
            }
        }

        // Filled spectrum area with gradient
        ctx.beginPath(); ctx.moveTo(pL, pT+ph);
        var bw=pw/bins;
        for(var i=1;i<bins;i++){
            var freq=(i/bins)*nyq, bx=pL+(freq/nyq)*pw;
            var db2=toDb(mag[i]);
            var by=pT+ph*(1-((db2+80)/80));
            ctx.lineTo(bx, by);
        }
        ctx.lineTo(pL+pw, pT+ph); ctx.closePath();
        var areaGrad=ctx.createLinearGradient(0,pT,0,pT+ph);
        areaGrad.addColorStop(0,'rgba(0,212,255,0.45)');
        areaGrad.addColorStop(0.5,'rgba(0,136,204,0.15)');
        areaGrad.addColorStop(1,'rgba(0,136,204,0.02)');
        ctx.fillStyle=areaGrad; ctx.fill();

        // Spectrum line
        ctx.beginPath(); ctx.moveTo(pL, pT+ph);
        for(var i=1;i<bins;i++){
            var freq=(i/bins)*nyq, bx=pL+(freq/nyq)*pw;
            var db2=toDb(mag[i]);
            var by=pT+ph*(1-((db2+80)/80));
            ctx.lineTo(bx, by);
        }
        ctx.strokeStyle='rgba(0,212,255,0.9)'; ctx.lineWidth=1.5;
        ctx.stroke();

        // Harmonic markers with labels
        ctx.setLineDash([2,4]);
        for(var h=1;h<=13;h++){
            var hf=50*h; if(hf>nyq) break;
            var hx=pL+(hf/nyq)*pw;
            var isF=h===1;
            ctx.strokeStyle=isF?'rgba(0,255,140,0.6)':'rgba(255,80,100,0.35)';
            ctx.lineWidth=isF?1.5:0.8;
            ctx.beginPath(); ctx.moveTo(hx,pT); ctx.lineTo(hx,pT+ph); ctx.stroke();
            ctx.fillStyle=isF?'#00ff8c':'#ff4060';
            ctx.font=(isF?'bold ':'')+'8px JetBrains Mono,monospace'; ctx.textAlign='center';
            ctx.fillText('H'+h, hx, pT-8);
            // Magnitude label at top of peak
            var bin2=Math.round(hf/nyq*bins);
            if(bin2<bins){
                var db3=toDb(mag[bin2]);
                var py=pT+ph*(1-((db3+80)/80))-6;
                if(py>pT+8 && db3>-60){
                    ctx.fillStyle=isF?'rgba(0,255,140,0.7)':'rgba(255,80,100,0.5)';
                    ctx.font='7px JetBrains Mono,monospace';
                    ctx.fillText(db3.toFixed(1)+'dB', hx, py);
                }
            }
        }
        ctx.setLineDash([]);

        // Title and axis labels
        ctx.font='bold 12px JetBrains Mono,monospace'; ctx.textAlign='left';
        ctx.fillStyle='#4cd9ff';
        ctx.fillText('∿ FFT — '+chName+' ('+unit+')', pL, 22);
        ctx.font='9px JetBrains Mono,monospace'; ctx.fillStyle='rgba(60,100,140,0.8)';
        ctx.textAlign='center';
        ctx.fillText('FRECUENCIA (Hz)', pL+pw/2, H-4);
        ctx.save();
        ctx.translate(14, pT+ph/2);
        ctx.rotate(-Math.PI/2);
        ctx.fillText('MAGNITUD (dB)', 0, 0);
        ctx.restore();
    }

    // Helpers
    function niceStep(v) {
        var m=Math.pow(10,Math.floor(Math.log10(v))), f=v/m;
        return f<1.5?m : f<3.5?2*m : f<7.5?5*m : 10*m;
    }
    function fmtTime(ms) {
        return ms>=1000 ? (ms/1000).toFixed(2)+'s' : ms>=1 ? ms.toFixed(1)+'ms' : (ms*1000).toFixed(0)+'µs';
    }
    function binSearch(arr, val) {
        var lo=0, hi=arr.length-1;
        while(lo<hi){ var mid=(lo+hi)>>1; if(arr[mid]<val) lo=mid+1; else hi=mid; }
        return lo;
    }

    return { render:render, renderFFT:renderFFT, _binSearch:binSearch, _fmtTime:fmtTime };
})();


// ============================================================
//  LAYER 5 — UI CONTROLLER
// ============================================================
var OscilloController = (function () {

    var st = {
        cfg:null, dat:null, analysis:null,
        channels:[], analogChs:[], digitalChs:[],
        ts:null,
        viewStart:0, viewEnd:100, totalDur:100,
        cursorX:null, trigMs:null, events:[],
    };

    var cfgFile=null, datFile=null;
    var canvas=null, ctx=null, dirty=true, raf=null;

    // ── Init ──────────────────────────────────────────────────
    function init() {
        canvas = document.getElementById('osc-canvas');
        if (!canvas) return;
        ctx = canvas.getContext('2d');

        document.getElementById('osc-cfg-input').addEventListener('change', function(e){
            cfgFile = e.target.files[0];
            document.getElementById('osc-cfg-name').textContent = cfgFile ? cfgFile.name : 'Sin archivo';
            updateAnalyzeBtn();
        });
        document.getElementById('osc-dat-input').addEventListener('change', function(e){
            datFile = e.target.files[0];
            document.getElementById('osc-dat-name').textContent = datFile ? datFile.name : 'Sin archivo';
            updateAnalyzeBtn();
        });
        document.getElementById('osc-analyze-btn').addEventListener('click', loadAndProcess);
        document.getElementById('osc-zoom-in').addEventListener('click',  function(){ zoom(0.45); });
        document.getElementById('osc-zoom-out').addEventListener('click', function(){ zoom(2.2); });
        document.getElementById('osc-zoom-fit').addEventListener('click', fitView);
        document.getElementById('osc-fft-btn').addEventListener('click', openFFTDefault);

        canvas.addEventListener('mousemove',  onMouseMove);
        canvas.addEventListener('mouseleave', function(){ st.cursorX=null; dirty=true;
            var el=document.getElementById('osc-cursor-readout'); if(el) el.textContent='Cursor: —'; });
        canvas.addEventListener('wheel', onWheel, { passive:false });

        initScrollbar();

        (function loop(){
            if(dirty){ resizeCanvas(); OscRender.render(ctx,st); dirty=false; }
            raf = requestAnimationFrame(loop);
        })();
    }

    function resizeCanvas() {
        var c = document.getElementById('osc-chart-area');
        if(!c||!canvas) return;

        // Width always matches the container
        var newW = c.clientWidth;

        // Height = full virtual stack of all channels (so nothing is clipped)
        // We calculate this the same way buildLayout does, independently of container height
        var newH = 10; // top padding (matches buildLayout y=10 start)
        if (st.channels && st.channels.length) {
            st.channels.forEach(function(ch) {
                if (!ch.visible) return;
                var h = ch.type === 'digital' ? 32 : 110;
                newH += h + 6; // CH_H values
            });
        }
        newH += 24; // bottom padding (matches buildLayout + 24)
        // Minimum: fill the container so it doesn't look empty with few channels
        newH = Math.max(newH, c.clientHeight);

        if (canvas.width !== newW || canvas.height !== newH) {
            canvas.width  = newW;
            canvas.height = newH;
            dirty = true;
        }
    }

    function updateAnalyzeBtn() {
        var btn=document.getElementById('osc-analyze-btn');
        if(btn) btn.disabled = !(cfgFile && datFile);
    }

    // ── Load & Process ────────────────────────────────────────
    function loadAndProcess() {
        if(!cfgFile||!datFile) return;
        var btn=document.getElementById('osc-analyze-btn');
        btn.textContent='⏳ Analizando…'; btn.disabled=true;

        readText(cfgFile, function(cfgTxt) {
            var cfg;
            try { cfg = ComtradeParser.parseCfg(cfgTxt); }
            catch(e){ showToast('Error en .cfg: '+e.message,'error'); resetBtn(btn); return; }

            if(cfg.dataFormat==='ASCII') {
                readText(datFile, function(datTxt){ process(cfg, datTxt, null); resetBtn(btn); });
            } else {
                readBin(datFile, function(buf){ process(cfg, null, buf); resetBtn(btn); });
            }
        });
    }

    function resetBtn(btn){ btn.textContent='⚡ Analizar'; btn.disabled=false; }

    function process(cfg, datTxt, datBuf) {
        var dat;
        try {
            dat = cfg.dataFormat==='ASCII'
                ? ComtradeParser.parseDatAscii(datTxt, cfg)
                : ComtradeParser.parseDatBinary(datBuf, cfg);
        } catch(e){ showToast('Error en .dat: '+e.message,'error'); return; }

        var val = ComtradeParser.validate(cfg, dat);
        if(!val.ok){ showToast('Validación: '+val.errors.join(', '),'error'); return; }
        val.warnings.forEach(function(w){ showToast(w,'warning'); });

        var analogChs  = ComtradeNorm.buildAnalog(cfg, dat);
        var digitalChs = ComtradeNorm.buildDigital(cfg, dat);
        var analysis   = ElecAnalyzer.run(cfg, dat.ts, analogChs, digitalChs);

        // Merged channel list for renderer
        var channels = [];
        analogChs.forEach(function(c){ channels.push(c); });
        digitalChs.forEach(function(c){ channels.push(c); });

        st.cfg=cfg; st.dat=dat; st.analysis=analysis;
        st.channels=channels; st.analogChs=analogChs; st.digitalChs=digitalChs;
        st.ts=dat.ts;
        st.totalDur=analysis.totalDurMs;
        st.viewStart=0; st.viewEnd=st.totalDur;
        st.events=analysis.events;
        st.trigMs=analysis.trigMs;
        dirty=true;

        populateUI(cfg, analysis, analogChs, digitalChs);
    }

    // ── Populate UI after load ────────────────────────────────
    function populateUI(cfg, analysis, analogChs, digitalChs) {
        show('osc-empty-state', false);
        show('osc-chart-area', true);
        show('osc-scrollbar-wrap', true);
        show('osc-info-panel', true);
        show('osc-topbar', true);
        show('osc-view-tabs', true);
        show('osc-channel-list', true);
        _currentView = 'waveform';
        _envActiveChs = {};
        // Reset envelope toggles so they rebuild for the new file
        var togglesEl = document.getElementById('osc-env-ch-toggles');
        if(togglesEl) togglesEl.innerHTML = '';
        document.querySelectorAll('.osc-view-tab').forEach(function(b){
            b.classList.toggle('active', b.dataset.oscView==='waveform');
        });
        var specEl = document.getElementById('osc-spectrogram-area');
        if(specEl) specEl.classList.remove('active');

        // Meta bar
        setText('osc-station-label', '⬡ '+cfg.header.stationName);
        setText('osc-device-label',  '◈ '+cfg.header.deviceId);
        setText('osc-ts-label',      '◷ '+(cfg.tsFirst?cfg.tsFirst.raw:'—'));
        setText('osc-sr-label',      '∿ '+analysis.sr.toLocaleString()+' Hz');
        setText('osc-dur-label',     '⏱ '+st.totalDur.toFixed(1)+' ms');

        buildChannelToggles(analogChs, digitalChs);
        buildEventsList(analysis.events);
        buildRmsTable(analysis.rms);
        updateScrollbar();
        showToast('Oscilografía cargada — '+cfg.totalSamples+' muestras, '+analysis.events.length+' eventos detectados','success');
    }

    function buildChannelToggles(aChs, dChs) {
        var aEl=document.getElementById('osc-analog-channels');
        var dEl=document.getElementById('osc-digital-channels');
        aEl.innerHTML=''; dEl.innerHTML='';

        aChs.forEach(function(ch,i){
            var d=document.createElement('div'); d.className='osc-ch-item';
            d.innerHTML='<span class="osc-ch-dot" style="background:'+ch.color+'"></span>'+
                '<label class="osc-ch-label">'+
                '<input type="checkbox" checked onchange="OscilloController.toggleCh(\'a\','+i+',this.checked)">'+
                ' '+ch.name+' <span class="osc-ch-unit">('+ch.unit+')</span></label>'+
                '<button class="osc-fft-ch-btn" onclick="OscilloController.showFFT('+i+')">〜</button>';
            aEl.appendChild(d);
        });
        dChs.forEach(function(ch,i){
            var d=document.createElement('div'); d.className='osc-ch-item';
            d.innerHTML='<span class="osc-ch-dot" style="background:'+ch.color+'"></span>'+
                '<label class="osc-ch-label">'+
                '<input type="checkbox" checked onchange="OscilloController.toggleCh(\'d\','+i+',this.checked)">'+
                ' '+ch.name+'</label>';
            dEl.appendChild(d);
        });
    }

    function buildEventsList(events) {
        var el=document.getElementById('osc-events-list');
        el.innerHTML='';
        if(!events.length){
            el.innerHTML='<div style="font-family:monospace;font-size:10px;color:#1e3044;">Sin eventos detectados</div>';
            return;
        }
        events.forEach(function(ev){
            var d=document.createElement('div'); d.className='osc-event-item';
            d.style.borderLeftColor=ev.color||'#ff9f00';
            d.innerHTML='<div class="osc-ev-label">'+ev.label+'</div>'+
                '<div class="osc-ev-time">'+ev.tMs.toFixed(3)+' ms</div>'+
                '<div class="osc-ev-detail">'+ev.detail+'</div>';
            d.addEventListener('click', function(){ jumpTo(ev.tMs); });
            el.appendChild(d);
        });
    }


    // ── Channel toggle ────────────────────────────────────────
    function toggleCh(type, idx, visible) {
        var chs = type==='a' ? st.analogChs : st.digitalChs;
        if(chs[idx]) { chs[idx].visible=visible; dirty=true; }
    }

    // ── FFT ───────────────────────────────────────────────────
    function showFFT(idx) {
        var ch=st.analogChs[idx]; if(!ch) return;
        var centerUs = (st.viewStart+st.viewEnd)/2*1000;
        var startIdx = OscRender._binSearch(st.ts, centerUs);
        var fftN     = Math.min(2048, st.ts.length-startIdx);
        var mag      = ElecAnalyzer.computeFFT(ch.data, startIdx, fftN);
        var fc       = document.getElementById('osc-fft-canvas');
        OscRender.renderFFT(fc.getContext('2d'), mag, st.analysis.sr, ch.name, ch.unit);

        // Harmonic table
        var html='';
        for(var h=1;h<=15;h++){
            var f=50*h; if(f>=st.analysis.sr/2) break;
            var bin=Math.round(f/(st.analysis.sr/2)*mag.length);
            var m=bin<mag.length?mag[bin]:0;
            var sc=ch.unit==='V'?m/1000:m, u=ch.unit==='V'?'kV':'A';
            var cls='osc-harmonic'+(h===1?' fundamental':'');
            html+='<span class="'+cls+'">H'+h+' ('+f+'Hz): '+sc.toFixed(3)+' '+u+'</span>';
        }
        document.getElementById('osc-fft-harmonics').innerHTML=html;
        document.getElementById('osc-fft-channel-name').textContent=ch.name;
        document.getElementById('osc-fft-overlay').style.display='flex';
    }

    function openFFTDefault() {
        for(var i=0;i<st.analogChs.length;i++){
            if(st.analogChs[i].visible){ showFFT(i); return; }
        }
    }

    // ── Navigation ────────────────────────────────────────────
    function jumpTo(tMs) {
        var half=(st.viewEnd-st.viewStart)/2;
        st.viewStart=Math.max(0,tMs-half);
        st.viewEnd=Math.min(st.totalDur,tMs+half);
        dirty=true; updateScrollbar();
    }

    function zoom(factor) {
        var center=(st.viewStart+st.viewEnd)/2;
        var half  =(st.viewEnd-st.viewStart)/2*factor;
        half=Math.max(0.2,Math.min(half,st.totalDur/2));
        st.viewStart=Math.max(0,center-half);
        st.viewEnd  =Math.min(st.totalDur,center+half);
        dirty=true; updateScrollbar();
    }

    function fitView() {
        st.viewStart=0; st.viewEnd=st.totalDur;
        dirty=true; updateScrollbar();
    }

    function onWheel(e) {
        e.preventDefault();
        var rect=canvas.getBoundingClientRect();
        var frac=(e.clientX-rect.left-70)/(rect.width-80);
        var pivot=st.viewStart+frac*(st.viewEnd-st.viewStart);
        var factor=e.deltaY>0?1.4:0.72;
        var dur=(st.viewEnd-st.viewStart)*factor;
        dur=Math.max(0.5,Math.min(dur,st.totalDur));
        st.viewStart=Math.max(0,pivot-frac*dur);
        st.viewEnd  =st.viewStart+dur;
        if(st.viewEnd>st.totalDur){ st.viewEnd=st.totalDur; st.viewStart=Math.max(0,st.viewEnd-dur); }
        dirty=true; updateScrollbar();
    }

    function onMouseMove(e) {
        var rect=canvas.getBoundingClientRect();
        st.cursorX=e.clientX-rect.left;
        var frac=(st.cursorX-70)/(rect.width-80);
        var tMs=st.viewStart+frac*(st.viewEnd-st.viewStart);
        var el=document.getElementById('osc-cursor-readout');
        if(!el) return;

        var readout='t = '+tMs.toFixed(3)+' ms';
        if(st.ts) {
            var idx=OscRender._binSearch(st.ts, tMs*1000);
            st.analogChs.forEach(function(ch){
                if(!ch.visible) return;
                var v=ch.data[idx];
                var scale=ch.unit==='V'?1/1000:1, u=ch.unit==='V'?'kV':'A';
                readout+='  |  '+ch.name+': '+(v*scale).toFixed(ch.unit==='V'?3:1)+u;
            });
        }
        el.textContent=readout;
        dirty=true;
    }

    // ── Scrollbar ─────────────────────────────────────────────
    function updateScrollbar() {
        var thumb=document.getElementById('osc-scrollbar-thumb');
        if(!thumb||!st.totalDur) return;
        var tw=thumb.parentElement.clientWidth;
        var dur=st.viewEnd-st.viewStart;
        var w=Math.max(16,(dur/st.totalDur)*tw);
        var l=(st.viewStart/st.totalDur)*tw;
        thumb.style.width=w+'px'; thumb.style.left=l+'px';
    }

    function initScrollbar() {
        var thumb=document.getElementById('osc-scrollbar-thumb');
        if(!thumb) return;
        var dragging=false, sx, sv;
        thumb.addEventListener('mousedown',function(e){
            dragging=true; sx=e.clientX; sv=st.viewStart; e.stopPropagation();
        });
        document.addEventListener('mousemove',function(e){
            if(!dragging) return;
            var tw=thumb.parentElement.clientWidth;
            var dt=(e.clientX-sx)/tw*st.totalDur;
            var dur=st.viewEnd-st.viewStart;
            st.viewStart=Math.max(0,Math.min(st.totalDur-dur,sv+dt));
            st.viewEnd=st.viewStart+dur;
            dirty=true; updateScrollbar();
        });
        document.addEventListener('mouseup',function(){ dragging=false; });
    }

    // ── Helpers ───────────────────────────────────────────────
    function readText(f,cb){ var r=new FileReader(); r.onload=function(e){cb(e.target.result);}; r.readAsText(f); }
    function readBin(f,cb) { var r=new FileReader(); r.onload=function(e){cb(e.target.result);}; r.readAsArrayBuffer(f); }
    function show(id,on)   { var el=document.getElementById(id); if(el) el.style.display=on?'':'none'; }
    function setText(id,t) { var el=document.getElementById(id); if(el) el.textContent=t; }

    // ── View switcher (waveform / spectrogram / envelope) ────
    var _currentView = 'waveform';
    function switchView(view) {
        _currentView = view;
        document.querySelectorAll('.osc-view-tab').forEach(function(b){
            b.classList.toggle('active', b.dataset.oscView===view);
        });
        var waveEls = ['osc-chart-area','osc-scrollbar-wrap','osc-info-panel'];
        var specEl  = document.getElementById('osc-spectrogram-area');
        var envEl   = document.getElementById('osc-envelope-area');

        // Always hide all secondary views first
        waveEls.forEach(function(id){ show(id, false); });
        if(specEl) specEl.classList.remove('active');
        if(envEl)  envEl.classList.remove('active');

        if(view === 'waveform'){
            waveEls.forEach(function(id){ show(id, true); });
        } else if(view === 'spectrogram'){
            if(specEl) specEl.classList.add('active');
            populateSpecChSelect();
        } else if(view === 'envelope'){
            if(envEl) envEl.classList.add('active');
            // Small delay so the canvas has layout dimensions
            setTimeout(function(){ initEnvelopeView(); }, 30);
        }
    }

    function populateSpecChSelect() {
        var sel = document.getElementById('osc-spec-ch-select');
        if(!sel || !st.analogChs) return;
        sel.innerHTML = '';
        st.analogChs.forEach(function(ch,i){
            var opt = document.createElement('option');
            opt.value = i;
            opt.textContent = ch.name + ' (' + ch.unit + ')';
            sel.appendChild(opt);
        });
    }

    // ── Spectrogram (Time × Frequency) ───────────────────────
    function renderSpectrogram() {
        var sel = document.getElementById('osc-spec-ch-select');
        if(!sel || !st.analogChs) return;
        var idx = parseInt(sel.value);
        var ch  = st.analogChs[idx];
        if(!ch) return;

        var colormapName = document.getElementById('osc-spec-colormap').value || 'plasma';
        var canvas = document.getElementById('osc-spec-canvas');
        var wrap   = canvas.parentElement;

        // Layout
        canvas.style.display = 'block';
        document.getElementById('osc-spec-empty').style.display = 'none';
        document.getElementById('osc-spec-axis-x').style.display = 'flex';
        document.getElementById('osc-spec-colorbar').style.display = 'flex';

        var W = wrap.clientWidth || 800;
        var H = wrap.clientHeight - 28 || 400;
        canvas.width  = W;
        canvas.height = H;

        var sr      = st.analysis.sr;
        var data    = ch.data;
        var N       = data.length;
        var fftSize = 512;   // window per column
        var hop     = Math.max(1, Math.floor(fftSize / 4));
        var numCols = Math.floor((N - fftSize) / hop) + 1;
        var numFreqs= fftSize / 2;

        // Frequency range: 0 → sr/2  (Nyquist), clamp to 1200 Hz for power analysis
        var maxFreqIdx = Math.round(Math.min(1200, sr/2) / (sr/2) * numFreqs);
        var displayFreqs = maxFreqIdx;

        // Compute STFT magnitude columns
        var columns = [];
        var globalMax = 0;
        for(var col=0; col<numCols; col++){
            var start = col * hop;
            var mag = ElecAnalyzer.computeFFT(data, start, fftSize);
            var colData = new Float32Array(displayFreqs);
            for(var fi=0; fi<displayFreqs; fi++){
                colData[fi] = mag[fi+1]; // skip DC
            }
            columns.push(colData);
            for(var fi=0; fi<displayFreqs; fi++){
                if(colData[fi]>globalMax) globalMax=colData[fi];
            }
        }
        if(globalMax<1e-9) globalMax=1;

        // Colormaps
        var colormaps = {
            plasma:   [[13,8,135],[84,2,163],[139,10,165],[185,50,137],[219,92,104],[244,136,73],[254,188,43],[240,249,33]],
            viridis:  [[68,1,84],[72,40,120],[62,83,160],[49,104,142],[38,130,142],[31,158,137],[53,183,121],[110,206,88],[181,222,43],[253,231,37]],
            inferno:  [[0,0,4],[40,11,84],[101,21,110],[159,42,99],[212,72,66],[245,125,21],[252,185,20],[252,255,164]],
            thermal:  [[0,0,50],[0,50,150],[0,150,200],[0,200,100],[100,220,50],[220,180,20],[255,100,0],[255,255,255]],
            cyberpunk:[[5,0,30],[20,0,80],[0,50,180],[0,150,220],[0,255,180],[100,255,50],[255,220,0],[255,50,100]]
        };
        var cmap = colormaps[colormapName] || colormaps.plasma;

        function sampleColor(t) {
            t = Math.max(0, Math.min(1, t));
            var s = t * (cmap.length-1);
            var i = Math.floor(s), f = s - i;
            if(i>=cmap.length-1) return cmap[cmap.length-1];
            var a=cmap[i], b=cmap[i+1];
            return [
                Math.round(a[0]+(b[0]-a[0])*f),
                Math.round(a[1]+(b[1]-a[1])*f),
                Math.round(a[2]+(b[2]-a[2])*f)
            ];
        }

        var ctx2 = canvas.getContext('2d');
        ctx2.fillStyle = '#080d14'; ctx2.fillRect(0,0,W,H);

        var padL=52, padR=4, padT=4, padB=24;
        var pw=W-padL-padR, ph=H-padT-padB;

        // Draw spectrogram pixels
        var imgd = ctx2.createImageData(pw, ph);
        var colW  = pw / numCols;
        var rowH  = ph / displayFreqs;

        for(var col=0; col<numCols; col++){
            var x0=Math.round(col*colW), x1=Math.round((col+1)*colW);
            for(var fi=0; fi<displayFreqs; fi++){
                var val = columns[col][fi] / globalMax;
                // dB scale for better dynamic range
                var db = val>0 ? 20*Math.log10(val) : -80;
                var t = Math.max(0, (db+80)/80); // normalize -80..0 dB
                var color = sampleColor(t);
                var y0=Math.round(ph-(fi+1)*rowH)+padT;
                var y1=Math.round(ph-fi*rowH)+padT;
                for(var px=x0; px<x1; px++){
                    for(var py=y0; py<y1; py++){
                        if(px<0||px>=pw||py<0||py>=ph+padT) continue;
                        var offset=((py)*pw+px)*4;
                        imgd.data[offset]   = color[0];
                        imgd.data[offset+1] = color[1];
                        imgd.data[offset+2] = color[2];
                        imgd.data[offset+3] = 255;
                    }
                }
            }
        }
        ctx2.putImageData(imgd, padL, 0);

        // Y-axis (Frequency)
        ctx2.font = '9px JetBrains Mono, monospace';
        ctx2.textAlign = 'right';
        ctx2.fillStyle = '#3d6080';
        var freqStep = maxFreqIdx*sr/(2*numFreqs);  // Hz per maxFreq
        var labelHz  = [0, 50, 100, 150, 200, 300, 400, 600, 800, 1000, 1200];
        labelHz.forEach(function(hz){
            if(hz > sr/2) return;
            var t = hz / (sr/2);
            var y = padT + ph - t*(ph/1)*(maxFreqIdx/numFreqs);
            // recompute: fi/displayFreqs maps to hz = fi*(sr/2)/numFreqs
            var fi2 = hz / (sr / 2) * numFreqs;
            var yy = padT + ph - (fi2/displayFreqs)*ph;
            if(yy<padT || yy>padT+ph) return;
            ctx2.fillStyle='#243a50';
            ctx2.beginPath(); ctx2.moveTo(padL,yy); ctx2.lineTo(padL+pw,yy); ctx2.stroke();
            ctx2.fillStyle='#3d6080';
            ctx2.fillText(hz+'Hz', padL-4, yy+3);
            ctx2.strokeStyle='rgba(60,100,130,0.3)'; ctx2.lineWidth=0.5;
            ctx2.beginPath(); ctx2.moveTo(padL,yy); ctx2.lineTo(padL+pw,yy); ctx2.stroke();
        });

        // Y-axis label
        ctx2.save();
        ctx2.translate(10, padT+ph/2);
        ctx2.rotate(-Math.PI/2);
        ctx2.fillStyle='#3d6080'; ctx2.font='9px JetBrains Mono,monospace'; ctx2.textAlign='center';
        ctx2.fillText('FRECUENCIA (Hz)', 0, 0);
        ctx2.restore();

        // X-axis (Time) - drawn separately in axis div
        var axisEl = document.getElementById('osc-spec-axis-x');
        axisEl.innerHTML='';
        var totalMs = st.totalDur;
        var numLabels = Math.min(10, Math.floor(pw/60));
        for(var li=0; li<=numLabels; li++){
            var t2 = li/numLabels;
            var ms = t2*totalMs;
            var sp = document.createElement('span');
            sp.style.cssText='position:absolute;left:'+(padL+t2*pw)+'px;transform:translateX(-50%);color:#3d6080;font-family:monospace;font-size:9px;';
            sp.textContent = ms>=1000?(ms/1000).toFixed(2)+'s':ms.toFixed(0)+'ms';
            axisEl.appendChild(sp);
        }
        axisEl.style.position='relative';
        var xlabel=document.createElement('span');
        xlabel.style.cssText='position:absolute;right:8px;color:#3d6080;font-family:monospace;font-size:9px;';
        xlabel.textContent='TIEMPO';
        axisEl.appendChild(xlabel);

        // Colorbar gradient
        var cbCanvas = document.getElementById('osc-spec-cb-gradient');
        var cbH = document.getElementById('osc-spec-colorbar').clientHeight - 60;
        cbCanvas.width=18; cbCanvas.height=Math.max(cbH,100);
        var cbCtx=cbCanvas.getContext('2d');
        for(var y=0;y<cbCanvas.height;y++){
            var t3=1-(y/cbCanvas.height);
            var c3=sampleColor(t3);
            cbCtx.fillStyle='rgb('+c3[0]+','+c3[1]+','+c3[2]+')';
            cbCtx.fillRect(0,y,18,1);
        }
        document.getElementById('osc-spec-cb-max').textContent='0dB';

        // Info
        var infoEl=document.getElementById('osc-spec-info');
        if(infoEl) infoEl.textContent=ch.name+' · '+numCols+' ventanas × FFT-'+fftSize+' · hop '+hop+' · '+(sr/2).toFixed(0)+'Hz Nyquist';
    }

    // ── Envelope — Amplitude vs Time ─────────────────────────
    var _envActiveChs = {};

    function initEnvelopeView() {
        if(!st.analogChs) return;
        var togglesEl = document.getElementById('osc-env-ch-toggles');
        if(!togglesEl) return;

        // Build channel toggles (all on by default)
        if(togglesEl.children.length === 0) {
            st.analogChs.forEach(function(ch, i) {
                _envActiveChs[i] = true;
                var btn = document.createElement('button');
                btn.className = 'osc-env-ch-btn active';
                btn.textContent = ch.name;
                btn.style.color = ch.color;
                btn.dataset.idx = i;
                btn.addEventListener('click', function() {
                    _envActiveChs[i] = !_envActiveChs[i];
                    btn.classList.toggle('active', _envActiveChs[i]);
                    renderEnvelope();
                });
                togglesEl.appendChild(btn);
            });

            // Re-render when window size changes
            document.getElementById('osc-env-window').addEventListener('change', renderEnvelope);
        }

        renderEnvelope();
    }

    function renderEnvelope() {
        if(!st.analogChs || !st.analogChs.length) return;

        var canvas = document.getElementById('osc-env-canvas');
        var emptyEl = document.getElementById('osc-env-empty');
        var sr = st.analysis.sr;

        // Determine RMS window size in samples
        var windowSel = document.getElementById('osc-env-window').value;
        var samplesPerCycle = Math.round(sr / 50);
        var winSize = windowSel === 'halfcycle' ? Math.round(samplesPerCycle / 2)
                    : windowSel === '5cycle'   ? samplesPerCycle * 5
                    : samplesPerCycle; // default: 1 cycle

        // Size canvas to its container
        var body = canvas.parentElement;
        var W = body.clientWidth  || 900;
        var H = body.clientHeight || 380;
        canvas.width  = W;
        canvas.height = H;
        canvas.style.display = 'block';
        if(emptyEl) emptyEl.style.display = 'none';

        var ctx = canvas.getContext('2d');

        // Background
        var bg = ctx.createLinearGradient(0, 0, 0, H);
        bg.addColorStop(0, '#080e18'); bg.addColorStop(1, '#04080f');
        ctx.fillStyle = bg; ctx.fillRect(0,0,W,H);

        var pL = 70, pR = 24, pT = 28, pB = 44;
        var pw = W-pL-pR, ph = H-pT-pB;

        // Compute RMS envelope for each active channel
        // Group by unit to share Y scale
        var envelopes = [];
        var groupPeakA = 0, groupPeakV = 0;

        st.analogChs.forEach(function(ch, i) {
            if(!_envActiveChs[i]) return;
            var data = ch.data;
            var N = data.length;
            var hop = Math.max(1, Math.floor(winSize / 4)); // 75% overlap for smooth curve
            var env = [];

            for(var s = 0; s + winSize <= N; s += hop) {
                // RMS over window
                var sum = 0;
                for(var k = s; k < s + winSize; k++) sum += data[k]*data[k];
                var rmsVal = Math.sqrt(sum / winSize);
                // Time at center of window (microseconds → ms)
                var tMs = st.ts[Math.min(s + Math.floor(winSize/2), N-1)] / 1000;
                env.push({ t: tMs, v: rmsVal });
            }

            var peak = 0;
            env.forEach(function(p){ if(p.v > peak) peak = p.v; });

            envelopes.push({ ch: ch, env: env, peak: peak });
            if(ch.unit === 'A' && peak > groupPeakA) groupPeakA = peak;
            if(ch.unit === 'V' && peak > groupPeakV) groupPeakV = peak;
        });

        if(!envelopes.length) return;

        // Y-axis label formatter
        function fmtY(v, unit) {
            if(unit === 'V') return (v/1000).toFixed(1)+'kV';
            return v.toFixed(0)+'A';
        }

        // ─── Split into current (A) and voltage (V) zones ───
        // Figure out which units are present
        var hasA = envelopes.some(function(e){ return e.ch.unit==='A'; });
        var hasV = envelopes.some(function(e){ return e.ch.unit==='V'; });
        var zones = [];
        if(hasA && hasV) {
            zones = [
                { unit:'A', peak:groupPeakA, y0:pT,        h:ph*0.5-4 },
                { unit:'V', peak:groupPeakV, y0:pT+ph*0.5+4, h:ph*0.5-4 }
            ];
        } else if(hasA) {
            zones = [{ unit:'A', peak:groupPeakA, y0:pT, h:ph }];
        } else {
            zones = [{ unit:'V', peak:groupPeakV, y0:pT, h:ph }];
        }

        var totalMs = st.totalDur;

        // ─── Draw zones ───────────────────────────────────────
        zones.forEach(function(zone) {
            var y0 = zone.y0, zh = zone.h;
            var yMid = y0 + zh;  // baseline (zero)
            var yPeak = zone.peak || 1;
            var isV = zone.unit === 'V';

            // Zone background
            ctx.fillStyle = 'rgba(0,136,204,0.02)';
            ctx.fillRect(pL, y0, pw, zh);

            // Zone divider
            if(hasA && hasV) {
                ctx.strokeStyle = 'rgba(0,136,204,0.08)';
                ctx.lineWidth = 1;
                ctx.setLineDash([4,4]);
                ctx.beginPath(); ctx.moveTo(pL, pT+ph*0.5); ctx.lineTo(pL+pw, pT+ph*0.5); ctx.stroke();
                ctx.setLineDash([]);
                // Zone label
                ctx.fillStyle = 'rgba(0,136,204,0.25)';
                ctx.font = 'bold 9px JetBrains Mono,monospace';
                ctx.textAlign = 'right';
                ctx.fillText(zone.unit==='A'?'CORRIENTE':'TENSIÓN', pL-4, y0+12);
            }

            // Horizontal grid lines (amplitude)
            var numGridLines = 4;
            ctx.font = '9px JetBrains Mono,monospace';
            ctx.textAlign = 'right';
            for(var g = 0; g <= numGridLines; g++) {
                var frac = g / numGridLines;
                var gy = yMid - frac * zh;
                var gv = frac * yPeak;
                ctx.strokeStyle = g===0 ? 'rgba(0,136,204,0.15)' : 'rgba(0,136,204,0.06)';
                ctx.lineWidth = g===0 ? 1 : 0.5;
                ctx.beginPath(); ctx.moveTo(pL, gy); ctx.lineTo(pL+pw, gy); ctx.stroke();
                ctx.fillStyle = g===0 ? 'rgba(0,136,204,0.5)' : 'rgba(60,100,140,0.6)';
                ctx.fillText(fmtY(gv, zone.unit), pL-4, gy+3);
            }
        });

        // ─── Time grid (vertical) ─────────────────────────────
        var numTLines = Math.min(12, Math.floor(pw / 80));
        ctx.font = '9px JetBrains Mono,monospace';
        ctx.textAlign = 'center';
        for(var ti = 0; ti <= numTLines; ti++) {
            var frac = ti / numTLines;
            var tx = pL + frac * pw;
            var tVal = frac * totalMs;
            ctx.strokeStyle = 'rgba(0,136,204,0.07)'; ctx.lineWidth = 0.5;
            ctx.beginPath(); ctx.moveTo(tx, pT); ctx.lineTo(tx, pT+ph); ctx.stroke();
            ctx.fillStyle = 'rgba(60,100,140,0.8)';
            ctx.fillText(tVal>=1000 ? (tVal/1000).toFixed(2)+'s' : tVal.toFixed(0)+'ms', tx, pT+ph+14);
        }

        // ─── Onset marker (vertical line where signal starts) ─
        if(st.trigMs !== null) {
            var txOnset = pL + (st.trigMs / totalMs) * pw;
            ctx.strokeStyle = 'rgba(255,159,0,0.5)'; ctx.lineWidth = 1.5;
            ctx.setLineDash([4,3]);
            ctx.beginPath(); ctx.moveTo(txOnset, pT-8); ctx.lineTo(txOnset, pT+ph); ctx.stroke();
            ctx.setLineDash([]);
            ctx.fillStyle = 'rgba(255,159,0,0.8)';
            ctx.font = 'bold 9px JetBrains Mono,monospace'; ctx.textAlign = 'center';
            ctx.fillText('▼ ONSET', txOnset, pT-10);
        }

        // ─── Draw envelopes ───────────────────────────────────
        envelopes.forEach(function(item) {
            var ch = item.ch, env = item.env;
            var zone = zones.find(function(z){ return z.unit===ch.unit; });
            if(!zone || !env.length) return;

            var y0 = zone.y0, zh = zone.h, yPeak = zone.peak || 1;

            function tToX(tMs){ return pL + (tMs / totalMs) * pw; }
            function vToY(v)  { return zone.y0 + zone.h - (v / yPeak) * zone.h; }

            // Filled area under envelope
            ctx.save();
            ctx.beginPath();
            ctx.rect(pL, y0, pw, zh);
            ctx.clip();

            ctx.beginPath();
            ctx.moveTo(tToX(env[0].t), vToY(0));
            env.forEach(function(p){ ctx.lineTo(tToX(p.t), vToY(p.v)); });
            ctx.lineTo(tToX(env[env.length-1].t), vToY(0));
            ctx.closePath();

            // Gradient fill from channel color
            var fillGrad = ctx.createLinearGradient(0, y0, 0, y0+zh);
            var hexColor = ch.color;
            var r=0,g=0,b=0;
            if(hexColor && hexColor[0]==='#') {
                r=parseInt(hexColor.substr(1,2),16);
                g=parseInt(hexColor.substr(3,2),16);
                b=parseInt(hexColor.substr(5,2),16);
            }
            fillGrad.addColorStop(0, 'rgba('+r+','+g+','+b+',0.22)');
            fillGrad.addColorStop(1, 'rgba('+r+','+g+','+b+',0.02)');
            ctx.fillStyle = fillGrad;
            ctx.fill();

            // Envelope line
            ctx.beginPath();
            env.forEach(function(p, i){
                var x = tToX(p.t), y = vToY(p.v);
                i===0 ? ctx.moveTo(x,y) : ctx.lineTo(x,y);
            });
            ctx.strokeStyle = ch.color;
            ctx.lineWidth = 2;
            ctx.lineJoin = 'round';
            ctx.stroke();

            // Peak annotation
            var maxPt = env.reduce(function(a,b){ return b.v>a.v?b:a; });
            var px = tToX(maxPt.t), py = vToY(maxPt.v);
            ctx.fillStyle = ch.color;
            ctx.beginPath(); ctx.arc(px, py, 3.5, 0, Math.PI*2); ctx.fill();
            ctx.font = 'bold 9px JetBrains Mono,monospace';
            ctx.textAlign = 'center';
            ctx.fillText(fmtY(maxPt.v, ch.unit), px, py-8);

            ctx.restore();

            // Channel name label at right edge
            var lastPt = env[env.length-1];
            var lx = tToX(lastPt.t), ly = vToY(lastPt.v);
            ctx.fillStyle = ch.color;
            ctx.font = 'bold 9px JetBrains Mono,monospace';
            ctx.textAlign = 'left';
            ctx.fillText(ch.name, Math.min(lx+5, pL+pw-30), Math.max(y0+12, Math.min(ly, y0+zh-4)));
        });

        // ─── Axis titles ──────────────────────────────────────
        ctx.fillStyle = 'rgba(60,100,140,0.7)';
        ctx.font = '9px JetBrains Mono,monospace';
        ctx.textAlign = 'center';
        ctx.fillText('TIEMPO', pL + pw/2, H-4);

        ctx.save();
        ctx.translate(12, pT + ph/2);
        ctx.rotate(-Math.PI/2);
        ctx.fillText('RMS', 0, 0);
        ctx.restore();

        // ─── Title ────────────────────────────────────────────
        ctx.fillStyle = 'rgba(0,212,255,0.6)';
        ctx.font = 'bold 11px JetBrains Mono,monospace';
        ctx.textAlign = 'left';
        var winLabel = windowSel==='halfcycle'?'½ ciclo':windowSel==='5cycle'?'5 ciclos':'1 ciclo';
        ctx.fillText('◈ ENVOLVENTE RMS — ventana ' + winLabel + ' — ' + winSize + ' muestras', pL, 18);

        // ─── Cursor interaction ───────────────────────────────
        // (re-attach mousemove for readout)
        canvas._envelopeData = { envelopes: envelopes, zones: zones, pL: pL, pw: pw, pT: pT, ph: ph, totalMs: totalMs };
        canvas.onmousemove = function(e) {
            var rect = canvas.getBoundingClientRect();
            var mx = e.clientX - rect.left;
            var frac = (mx - pL) / pw;
            if(frac<0||frac>1) return;
            var tMs = frac * totalMs;
            var ed = canvas._envelopeData;
            var readout = 't = ' + (tMs>=1000?(tMs/1000).toFixed(3)+'s':tMs.toFixed(1)+'ms');
            envelopes.forEach(function(item){
                // Find nearest envelope point
                var nearest = item.env.reduce(function(a,b){ return Math.abs(b.t-tMs)<Math.abs(a.t-tMs)?b:a; });
                var isV = item.ch.unit==='V';
                var val = isV ? (nearest.v/1000).toFixed(3)+'kV' : nearest.v.toFixed(1)+'A';
                readout += '  |  ' + item.ch.name + ' RMS: ' + val;
            });
            var el = document.getElementById('osc-cursor-readout');
            if(el) el.textContent = readout;
        };
        canvas.onmouseleave = function() {
            var el = document.getElementById('osc-cursor-readout');
            if(el) el.textContent = 'Cursor: —';
        };
    }

    return { init:init, toggleCh:toggleCh, showFFT:showFFT, switchView:switchView, renderSpectrogram:renderSpectrogram, renderEnvelope:renderEnvelope };


})();

// Auto-init
if(document.readyState==='loading'){
    document.addEventListener('DOMContentLoaded', function(){ OscilloController.init(); });
} else {
    OscilloController.init();
}
