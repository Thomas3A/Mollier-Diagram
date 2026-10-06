#!/usr/bin/env python3
"""
ewf_prototype.py — referentie-implementatie (orakel) van het Earth, Wind & Fire-model
=====================================================================================

Doel: Claude Code gebruikt dit bestand als *testorakel* bij het schrijven van de
JavaScript-implementatie (js/ewf/*.js). De JS-uitkomsten moeten binnen de in
SPEC.md §12 genoemde toleranties overeenkomen met de uitkomsten van dit script.

Bron van de fysica: B. Bronsema (2013), "Earth, Wind & Fire – Natuurlijke
Airconditioning", proefschrift TU Delft. Paragraaf- en formulenummers staan bij
de functies. Afwijkingen van het proefschrift zijn gemarkeerd met  # AFWIJKING.

Draaien:  python3 ewf_prototype.py            (validatie + voorbeeldscenario's)
Alleen standaardbibliotheek, Python ≥ 3.8.
"""
import math

# ---------------------------------------------------------------- constanten
G = 9.81                 # m/s²
P_STD = 101325.0         # Pa
RHO_W = 999.0            # kg/m³ water
CP_W = 4186.0            # J/(kg·K) water
CP_DA = 1006.0           # J/(kg·K) droge lucht
CP_V = 1860.0            # J/(kg·K) waterdamp
R_DA = 287.042           # J/(kg·K)
R_V = 461.5              # J/(kg·K)
SIGMA = 5.67e-8          # W/(m²·K⁴)
RHO_REF = 1.20           # kg/m³ — referentiedichtheid voor ventilatiedebieten (20 °C)

# ---------------------------------------------------------------- psychrometrie (ASHRAE 2017 h1 — gelijk aan js/psychro.js)
def p_ws_liquid(t):
    """Verzadigingsdampdruk boven (onderkoeld) water, Hyland-Wexler eq. 6 [Pa]."""
    T = t + 273.15
    return math.exp(-5.8002206e3 / T + 1.3914993 - 4.8640239e-2 * T + 4.1764768e-5 * T**2
                    - 1.4452093e-8 * T**3 + 6.5459673 * math.log(T))

def p_ws(t):
    """Boven water (t ≥ 0) of ijs (t < 0), Hyland-Wexler eq. 5/6 [Pa]."""
    if t >= 0:
        return p_ws_liquid(t)
    T = t + 273.15
    return math.exp(-5.6745359e3 / T + 6.3925247 - 9.6778430e-3 * T + 6.2215701e-7 * T**2
                    + 2.0747825e-9 * T**3 - 9.4840240e-13 * T**4 + 4.1635019 * math.log(T))

def x_from_pw(pw, p): return 0.621945 * pw / (p - pw)
def pw_from_x(x, p): return p * x / (0.621945 + x)
def x_sat(t, p): return x_from_pw(p_ws(t), p)
def x_from_t_rh(t, rh, p): return x_from_pw(rh / 100 * p_ws(t), p)
def rh_from(t, x, p): return 100 * pw_from_x(x, p) / p_ws(t)
def h_air(t, x): return CP_DA * t + x * (2501e3 + CP_V * t)          # J/kg droge lucht
def rho_moist(t, x, p): return p / (R_DA * (t + 273.15) * (1 + 1.607858 * x)) * (1 + x)
def r_evap(t): return 2501e3 - 2369.0 * t                          # J/kg, ≈ h_g(t) - h_f(t)

def t_sat_from_h(h, p, lo=-40, hi=60):
    """Verzadigingstemperatuur bij enthalpie h (voor mistcorrectie)."""
    for _ in range(80):
        mid = 0.5 * (lo + hi)
        if h_air(mid, x_sat(mid, p)) > h: hi = mid
        else: lo = mid
    return 0.5 * (lo + hi)

def air_props(t, p):
    """Dynamische viscositeit (Sutherland), warmtegeleiding, diffusiecoëff. waterdamp (Bronsema 3.2.7/3, ASHRAE)."""
    T = t + 273.15
    mu = 1.458e-6 * T**1.5 / (T + 110.4)
    lam = 0.0241 * (T / 273.15)**0.81
    Dv = 0.926 / (p / 1000) * T**2.5 / (T + 245) * 1e-6
    return mu, lam, Dv

# ---------------------------------------------------------------- 1. Wind & Ventecdak (Bronsema h2)
def wind_at_height(U10, z, z0=0.5, d=10.0):
    """Windsnelheid op hoogte z uit potentiële windsnelheid U10 (z0 = 0,03 m op 10 m).
    Bronsema 2.1.1, 2.5.1–2.5.3: U_meso(60 m) = U10·ln(60/0,03)/ln(10/0,03) ≈ 1,31·U10,
    U(z) = U_meso·ln((z−d)/z0)/ln(60/z0).  Voor z0 = 0,5; d = 10 ⇒ 0,273·U10·ln((z−10)/0,5)."""
    zeff = max(z - d, z0)                   # ondergrens; UI waarschuwt als z < d + 5 m (log-profiel onbetrouwbaar)
    Um = U10 * math.log(60 / 0.03) / math.log(10 / 0.03)
    return max(0.0, Um * math.log(zeff / z0) / math.log(60 / z0))

def cp_ejector(U_ej, U_ref, c=2.0):
    """Cp in de keel van de venturi-ejector, Bronsema 2.3.1 (c = 1 m) / 2.3.2 (c = 2 m), CFD + windtunnel.
    Geldigheid: 0,1 ≤ U_ej/U_ref ≤ 0,8 (buiten dit bereik: waarde op de grens + waarschuwing)."""
    if U_ref <= 0.05: return 0.0, 'geen wind'
    r = U_ej / U_ref
    flag = None
    if r < 0.1: r, flag = 0.1, 'U_ej/U_ref < 0,1: buiten geldigheidsgebied'
    if r > 0.8: r, flag = 0.8, 'U_ej/U_ref > 0,8: buiten geldigheidsgebied'
    cp = 0.5374 * math.log(r) + 0.6381 if c <= 1.5 else 0.2913 * math.log(r) + 0.0151
    return cp, flag

def ventecdak(U10, z_roof, q_exh, A_ej, rho, c=2.0, cp_in=0.8, z0=0.5, d=10.0):
    U_ref = wind_at_height(U10, z_roof, z0, d)
    qdyn = 0.5 * rho * U_ref**2
    U_ej = q_exh / A_ej
    cp_ej, flag = cp_ejector(U_ej, U_ref, c)
    return dict(U_ref=U_ref, p_over=cp_in * qdyn, p_ej=cp_ej * qdyn, cp_ej=cp_ej, U_ej=U_ej, flag=flag)

# ---------------------------------------------------------------- 2. Klimaatcascade (Bronsema h3)
def cd_sphere(Re):
    """Weerstandscoëfficiënt bol, Schiller-Naumann (1933) = 'Wallis (1969)' in Bronsema 3.2.4/3; 0,44 voor Re > 1000."""
    if Re < 1e-9: return 1e9
    return 24 / Re * (1 + 0.15 * Re**0.687) if Re < 1000 else 0.44

def drop_terminal(d, t=20.0, p=P_STD):
    """Relatieve eindsnelheid druppel [m/s] uit krachtenevenwicht (3.2.4/4). # AFWIJKING: niet formule 3.2.4/6."""
    rho_a = rho_moist(t, 0.008, p); mu = air_props(t, p)[0]; w = 3.0
    for _ in range(300):
        w = 0.5 * w + 0.5 * math.sqrt(4 * G * d * (RHO_W - rho_a) / (3 * rho_a * cd_sphere(rho_a * w * d / mu)))
    return w

def cascade(H, A_c, m_da, t_in, x_in, m_w, t_w_in, d30, d32, p=P_STD, w0=10.0, N=400, active=True):
    """Gelijkstroom druppel–lucht warmte- en stofoverdracht, celmodel van boven (z=H) naar beneden (z=0).
    - druppelsnelheid: impulsvergelijking met Cd(Re) op d30 (gewicht), start w0 (0,5 bar ≈ 10 m/s, §3.2.4)
    - oppervlak per cel: A = 6·V_water/d32  (Sauter)            # AFWIJKING: 3.2.5/7 gebruikt d32²/d30³
    - Nu/Sh: Ranz-Marshall (3.2.6/1, 3.2.7/1) op d32, Re met relatieve snelheid
    - verdamping/condensatie: β·A·(ρ_v,s(T_w) − ρ_v,lucht)  (3.2.2/3)
    - oververzadiging (mist) → isenthalpisch naar verzadiging, condensaat naar water
    - hydraulische trek: Σ (ṁ_w/A_c)·g·dt = holdup-gewicht (3.2.15/3–6)
    - aerodynamische trek (3.2.15/2) alleen informatief: Σ (ṁ_w/A_c)·(−Δw)."""
    w_a = m_da * (1 + x_in) / rho_moist(t_in, x_in, p) / A_c
    if not active or m_w <= 0:
        # droge schacht (variant A1): geen behandeling, geen hydraulische trek
        rho = rho_moist(t_in, x_in, p)
        prof = [dict(z=H * (1 - i / 10), t=t_in, x=x_in, tw=None, rho=rho) for i in range(11)]
        return dict(t=t_in, x=x_in, rh=rh_from(t_in, x_in, p), tw=None, Q=0.0, dp_hydr=0.0, dp_aero=0.0,
                    prof=prof, m_evap=0.0, w_a=w_a, t_res=0.0, balance_err=0.0)
    t, x, tw, mw, wd = t_in, x_in, t_w_in, m_w, w0
    dz = H / N
    dp_h = dp_a = t_res = 0.0
    prof = [dict(z=H, t=t, x=x, tw=tw, rho=rho_moist(t, x, p))]
    m_evap_tot = 0.0
    for i in range(N):
        mu, lam, Dv = air_props(t, p)
        rho_a = rho_moist(t, x, p)
        nu = mu / rho_a
        wr = wd - w_a
        dt = dz / wd
        acc = G * (1 - rho_a / RHO_W) - 0.75 * rho_a / RHO_W * cd_sphere(rho_a * abs(wr) * d30 / mu) * wr * abs(wr) / d30
        wd_new = max(wd + acc * dt, w_a + 0.05)
        dp_h += mw / A_c * G * dt
        dp_a += mw / A_c * (wd - wd_new)
        t_res += dt
        A = 6 * (mw / RHO_W * dt) / d32
        Re = abs(wr) * d32 / nu
        hc = (2 + 0.6 * 0.71**(1 / 3) * Re**0.5) * lam / d32
        beta = (2 + 0.6 * (nu / Dv)**(1 / 3) * Re**0.5) * Dv / d32
        rv_a = pw_from_x(x, p) / (R_V * (t + 273.15))
        rv_s = p_ws_liquid(tw) / (R_V * (tw + 273.15))
        m_ev = beta * A * (rv_s - rv_a)                    # kg/s, + = verdamping
        Qs = hc * A * (tw - t)                             # W naar de lucht
        cpm = CP_DA + CP_V * x
        t_n = t + (Qs + m_ev * CP_V * (tw - t)) / (m_da * cpm)
        x_n = x + m_ev / m_da
        tw_n = tw - (Qs + m_ev * r_evap(tw)) / (mw * CP_W)
        mw -= m_ev; m_evap_tot += m_ev
        t, x, tw, wd = t_n, x_n, tw_n, wd_new
        if x > x_sat(t, p):                                 # mist → verzadiging
            ts = t_sat_from_h(h_air(t, x), p, t - 15, t + 15)
            dx = x - x_sat(ts, p)
            t, x = ts, x_sat(ts, p); mw += dx * m_da; m_evap_tot -= dx * m_da
        prof.append(dict(z=H - (i + 1) * dz, t=t, x=x, tw=tw, rho=rho_moist(t, x, p)))
    Q = m_da * (h_air(t, x) - h_air(t_in, x_in))          # W (+ = lucht verwarmd)
    # balanscontrole: energie lucht + water = 0
    hw = lambda T: CP_W * T
    err = (Q + (mw * hw(tw) - m_w * hw(t_w_in))) / max(abs(Q), 1.0)
    return dict(t=t, x=x, rh=rh_from(t, x, p), tw=tw, Q=Q, dp_hydr=dp_h, dp_aero=dp_a, prof=prof,
                m_evap=m_evap_tot, w_a=w_a, t_res=t_res, balance_err=err, m_w_out=mw)

def cascade_auto_rwl(H, A_c, m_da, t_in, x_in, t_w_in, d30, d32, t_target, p, lo=0.3, hi=1.2):
    """Capaciteitsregeling via waterdebiet (Bronsema §3.5.3): zoek RW/L ∈ [lo, hi] zodat t_uit = t_target."""
    f = lambda r: cascade(H, A_c, m_da, t_in, x_in, r * m_da, t_w_in, d30, d32, p, N=200)['t'] - t_target
    if f(lo) <= 0: return lo, 'RW/L op minimum: lucht wordt kouder dan setpoint'
    if f(hi) >= 0: return hi, 'RW/L op maximum: setpoint niet haalbaar'
    for _ in range(30):
        mid = 0.5 * (lo + hi)
        if f(mid) > 0: lo = mid
        else: hi = mid
    return 0.5 * (lo + hi), None

def thermal_draft_profile(prof, t_e, x_e, p):
    """Σ g·dz·(ρ_kolom − ρ_e) over een verticaal profiel (geen rekenkundig gemiddelde, Bronsema §3.3.10)."""
    rho_e = rho_moist(t_e, x_e, p); s = 0.0
    for a, b in zip(prof[:-1], prof[1:]):
        s += G * abs(a['z'] - b['z']) * (0.5 * (a['rho'] + b['rho']) - rho_e)
    return s

# ---------------------------------------------------------------- 3. Zonneschoorsteen (Bronsema h4)
def g_angle_factor(theta_deg):
    """g(θ)/g(0) — polynoom uit Bronsema fig. 4.2.2 (WIS, HR 4-16-4 argon); 0 voor θ ≥ 90°."""
    if theta_deg >= 90: return 0.0
    g = lambda th: -2.173e-6 * th**3 + 1.387e-4 * th**2 - 2.415e-3 * th + 0.6747
    return max(0.0, g(theta_deg) / g(0))

def chimney(H, B, D, q, t_in, t_e, x_e, phi_beam, phi_diff, theta_beam, p=P_STD, g=0.70, U_glass=1.32, R=0.95,
            f1=0.25, f2=0.75, eps_w=0.05, eps_gl=0.87, U_wall=0.25, t_back=21.0, N=None, angle_corr=True, h_seg=3.5):
    """3-knopenmodel per segment (Bronsema 4.2.5.3, vgl. 4.2.5/13–15), gemarcheerd van voet naar top.
    phi_beam/phi_diff = directe resp. diffuse+grond straling op het glasvlak [W/m²].
    # AFWIJKING: knoopvergelijkingen als correcte energiebalansen geschreven (tekens/termen in 4.2.5/13 bevatten
    #            drukfouten); verlies binnenwand U_wall ook in knoop 3 (staat wel in 4.5.6/2, niet in 4.2.5/15);
    #            CWC = Churchill-Usagi menging van 1,5·ΔT^(1/3) (4.2.4/4) en 7,65·w (4.2.4/9)."""
    N = N or max(4, int(round(H / h_seg)) * 4)
    U_star = 1 / (1 / U_glass - 0.13)                    # glasbinnenoppervlak → buitenlucht (R_si = 0,13)
    ka = g_angle_factor(theta_beam) if angle_corr else 1.0
    kd = 0.874 if angle_corr else 1.0                     # hemisferisch gemiddelde van g(θ)/g(0)
    S = R * g * (phi_beam * ka + phi_diff * kd)          # doorgelaten zonnestraling per m² bruto glas
    B_str, B_conv = 0.872 * B + 1.6 * D, B + 2 * D       # schijnbare breedtes (4.2.5.3)
    w = q / (B * D)
    eres = 1 / (1 / eps_w + 1 / eps_gl - 1)
    dz = H / N
    ta, tgl, tw = t_in, t_e + 5, t_in + 10
    prof = [dict(z=0.0, t=ta, tgl=None, tw=None)]
    Qtot = dp = 0.0
    rho_e = rho_moist(t_e, x_e, p)
    for i in range(N):
        m = rho_moist(ta, x_e, p) * q
        ta_out = ta + 0.5
        for _ in range(300):
            tm = 0.5 * (ta + ta_out)
            hcg = ((1.5 * abs(tgl - tm)**(1 / 3))**3 + (7.65 * w)**3)**(1 / 3)
            hcw = ((1.5 * abs(tw - tm)**(1 / 3))**3 + (7.65 * w)**3)**(1 / 3)
            hs = 4 * eres * SIGMA * (0.5 * (tw + tgl) + 273.15)**3
            tgl_n = (f1 * S * B + B_str * hs * tw + B * U_star * t_e + B * hcg * tm) / (B * U_star + B * hcg + B_str * hs)
            tw_n = (f2 * S * B + B_conv * hcw * tm + B_str * hs * tgl_n + B * U_wall * t_back) / (B_conv * hcw + B_str * hs + B * U_wall)
            Qc = dz * (B * hcg * (tgl_n - tm) + B_conv * hcw * (tw_n - tm))
            ta_out_n = ta + Qc / (m * (CP_DA + CP_V * x_e))
            done = abs(ta_out_n - ta_out) < 1e-7 and abs(tgl_n - tgl) < 1e-7 and abs(tw_n - tw) < 1e-7
            tgl, tw, ta_out = 0.5 * (tgl + tgl_n), 0.5 * (tw + tw_n), 0.5 * (ta_out + ta_out_n)
            if done: break
        Qtot += m * (CP_DA + CP_V * x_e) * (ta_out - ta)
        dp += G * dz * (rho_e - rho_moist(0.5 * (ta + ta_out), x_e, p))
        ta = ta_out
        prof.append(dict(z=(i + 1) * dz, t=ta, tgl=tgl, tw=tw))
    inc = R * B * H * (phi_beam + phi_diff)
    return dict(t_out=ta, Q=Qtot, eta=Qtot / inc if inc > 1 else float('nan'), dp_th=dp, w=w, prof=prof,
                t_glass_max=max(pt['tgl'] for pt in prof[1:]), t_wall_max=max(pt['tw'] for pt in prof[1:]))

def friction_dp(L, Dh, w, rho, eps=0.010, nu=1.6e-5):
    """Wrijving (4.2.7/2); λ expliciet volgens 4.2.7/3 (Swamee-Jain-vorm van Colebrook-White), wandruwheid 10 mm."""
    Re = max(w * Dh / nu, 1.0)
    lam = 0.25 / math.log10(eps / (3.72 * Dh) + 5.74 / Re**0.901)**2
    return lam * L / Dh * 0.5 * rho * w**2

# ---------------------------------------------------------------- 4. Zon: positie, Erbs, Hay-Davies (alleen voor presets zonder GTI)
def sun_position(lat, lon, utc_hours, doy):
    """NOAA/Spencer-benadering. Geeft (hoogte, azimut vanaf zuid, + = west) in graden."""
    gam = 2 * math.pi / 365 * (doy - 1 + (utc_hours - 12) / 24)
    eqt = 229.18 * (0.000075 + 0.001868 * math.cos(gam) - 0.032077 * math.sin(gam) - 0.014615 * math.cos(2 * gam) - 0.040849 * math.sin(2 * gam))
    dec = 0.006918 - 0.399912 * math.cos(gam) + 0.070257 * math.sin(gam) - 0.006758 * math.cos(2 * gam) + 0.000907 * math.sin(2 * gam) - 0.002697 * math.cos(3 * gam) + 0.00148 * math.sin(3 * gam)
    tst = utc_hours * 60 + eqt + 4 * lon
    ha = math.radians(tst / 4 - 180)
    la = math.radians(lat)
    cz = math.sin(la) * math.sin(dec) + math.cos(la) * math.cos(dec) * math.cos(ha)
    zen = math.acos(max(-1, min(1, cz)))
    az = math.atan2(math.sin(ha), math.cos(ha) * math.sin(la) - math.tan(dec) * math.cos(la))
    return 90 - math.degrees(zen), math.degrees(az), doy

def erbs_hay_davies(ghi, alt, az_sun, doy, surf_az=0.0, tilt=90.0, albedo=0.2):
    """Erbs et al. (1982) splitsing GHI → DNI/DHI; Hay & Davies (1980) transpositie (Duffie & Beckman §2.16).
    Geeft (beam, diffuus+grond, invalshoek) op het vlak."""
    if ghi <= 0: return 0.0, 0.0, 90.0
    if alt < 5.0:                                        # lage zon: splitsing onbetrouwbaar → alles diffuus
        return 0.0, ghi * (0.5 * (1 + math.cos(math.radians(tilt))) + albedo * 0.5 * (1 - math.cos(math.radians(tilt)))), 90.0
    G0 = 1367 * (1 + 0.033 * math.cos(2 * math.pi * doy / 365))
    cz = math.sin(math.radians(alt))
    kt = min(ghi / (G0 * cz), 0.8)
    kd = 1 - 0.09 * kt if kt <= 0.22 else (0.9511 - 0.1604 * kt + 4.388 * kt**2 - 16.638 * kt**3 + 12.336 * kt**4 if kt <= 0.8 else 0.165)
    dhi = kd * ghi; bh = ghi - dhi; dni = bh / cz
    b = math.radians(tilt); cos_th = (math.cos(math.radians(alt)) * math.cos(math.radians(az_sun - surf_az)) * math.sin(b) + cz * math.cos(b))
    cos_th = max(0.0, cos_th)
    Ai = dni / G0
    circ = dhi * Ai * cos_th / cz
    iso = dhi * (1 - Ai) * (1 + math.cos(b)) / 2
    grd = ghi * albedo * (1 - math.cos(b)) / 2
    return dni * cos_th + circ, iso + grd, math.degrees(math.acos(min(1.0, cos_th)))

# ---------------------------------------------------------------- 5. Gebouwmodel (momentopname)
DEFAULT_BUILDING = dict(
    floors=8, h_floor=3.5, avo_per_floor=1000.0, bvo_factor=1.5,
    occ_density=0.10, presence=0.9, q_person=7.0, q_area=0.7,          # EN 16798-1 cat. II, laag-emitterend [dm³/s]
    q_int=35.0, moist_person=65.0,                                     # W/m² AVO (Bronsema tab. 7.4.4); g/h·p (§3.1.7.2)
    t_room_summer=25.0, t_room_winter=21.0, t_sup_cool=17.0, t_sup_heat=18.0,
    w_cascade=2.0, rwl_design=0.9, rwl_min=0.3, rwl_max=1.2, rwl_winter=0.9,
    d30=1.048e-3, d32=1.317e-3, w0=10.0, t_w_cool=13.0, t_w_heat=13.0, t_w_heat_frost=15.0,
    terrain_z0=0.5, terrain_d=10.0, roof_extra=4.0, cp_in=0.8, c_top=2.0, U_ej_design=1.0,
    chim_B=11.5, chim_D=0.65, chim_az=0.0, glass_g=0.70, glass_U=1.32, chim_R=0.95, f1=0.25, f2=0.75,
    eps_abs=0.05, U_wall=0.25,
    dp_sup_design=25.0, dp_exh_ext=5.0, w_shunt=1.0, zeta_ubend=0.5, dp_fiwihex=10.0,
    fiwi_eff=0.7, fiwi_t_water=20.0,
    p_nozzle=50e3, pipe_R=100.0, dp_local=1e3, eta_pump=0.75, dp_source=15e3, eta_fan=0.85 * 0.90,
)

def simulate(b, wx):
    """wx: t, rh, p, U10, phi_beam, phi_diff, theta (invalshoek op schoorsteen)."""
    p = wx.get('p', P_STD)
    t_e, x_e = wx['t'], x_from_t_rh(wx['t'], wx['rh'], p)
    n, hf = b['floors'], b['h_floor']
    H = n * hf
    avo = n * b['avo_per_floor']
    persons = avo * b['occ_density']
    q_v = (persons * b['q_person'] + avo * b['q_area']) / 1000            # m³/s
    m_da = q_v * RHO_REF / (1 + x_e)
    A_c = q_v / b['w_cascade']
    cooling = t_e > b['t_sup_cool']
    # --- klimaatcascade
    if cooling:
        tw_in = b['t_w_cool']
        rwl, note = cascade_auto_rwl(H, A_c, m_da, t_e, x_e, tw_in, b['d30'], b['d32'], b['t_sup_cool'], p, b['rwl_min'], b['rwl_max'])
    else:
        tw_in = b['t_w_heat_frost'] if t_e < 0 else b['t_w_heat']
        rwl, note = b['rwl_winter'], None
    cas = cascade(H, A_c, m_da, t_e, x_e, rwl * m_da, tw_in, b['d30'], b['d32'], p, b['w0'])
    t_sup = cas['t']; x_sup = cas['x']
    Q_reheat = 0.0
    t_set = b['t_sup_cool'] if cooling else b['t_sup_heat']
    if t_sup < t_set - 0.05:
        Q_reheat = m_da * (h_air(t_set, x_sup) - h_air(t_sup, x_sup)); t_sup = t_set
    # --- ruimte
    t_room = b['t_room_summer'] if cooling else b['t_room_winter']
    G_moist = persons * b['presence'] * b['moist_person'] / 3.6e6       # kg/s
    x_room = x_sup + G_moist / m_da
    Q_vent_sens = m_da * (CP_DA + CP_V * x_sup) * (t_room - t_sup)      # + = koelend vermogen van de ventilatielucht
    Q_int = b['q_int'] * avo * b['presence']
    # --- zonneschoorsteen
    chim = chimney(H, b['chim_B'], b['chim_D'], q_v, t_room, t_e, x_e, wx['phi_beam'], wx['phi_diff'], wx['theta'], p,
                   b['glass_g'], b['glass_U'], b['chim_R'], b['f1'], b['f2'], b['eps_abs'], 0.87, b['U_wall'], t_room,
                   angle_corr=wx.get('angle_corr', True))
    chim_open = chim['Q'] > 0                                            # kantelpunt §4.5.6.8
    t_top = chim['t_out'] if chim_open else t_room
    # --- FiWiHEx
    Q_hr = b['fiwi_eff'] * m_da * CP_DA * max(0.0, t_top - b['fiwi_t_water'])
    # --- Ventecdak
    rho_e = rho_moist(t_e, x_e, p)
    z_roof = H + b['roof_extra']
    A_ej = q_v / b['U_ej_design']
    vd = ventecdak(wx['U10'], z_roof, q_v, A_ej, rho_e, b['c_top'], b['cp_in'], b['terrain_z0'], b['terrain_d'])
    # --- drukbalans toevoer per verdieping
    dp_th_kc = thermal_draft_profile(cas['prof'], t_e, x_e, p)
    rho_ts = rho_moist(t_sup, x_sup, p)
    P_base = vd['p_over'] + cas['dp_hydr'] + dp_th_kc
    sup = []
    for k in range(1, n + 1):
        z = (k - 0.5) * hf
        sup.append(P_base - G * z * (rho_ts - rho_e) - b['dp_sup_design'])
    # --- drukbalans afvoer per verdieping
    rho_room = rho_moist(t_room, x_room, p)
    Dh_ch = 2 * b['chim_B'] * b['chim_D'] / (b['chim_B'] + b['chim_D'])
    dp_ch_fric = friction_dp(H, Dh_ch, chim['w'], RHO_REF)
    A_sh = q_v / b['w_shunt']; Dh_sh = math.sqrt(A_sh)               # vierkante shunt (aanname): Dh = zijde
    p_dyn_ch = 0.5 * RHO_REF * chim['w']**2
    exh = []
    dp_th_ch = chim['dp_th'] if chim_open else G * H * (rho_e - rho_room)
    for k in range(1, n + 1):
        z = (k - 0.5) * hf
        dp_sh = friction_dp(z, Dh_sh, b['w_shunt'], RHO_REF)
        avail = dp_th_ch + G * z * (rho_room - rho_e) - vd['p_ej']
        need = b['dp_exh_ext'] + dp_sh + b['zeta_ubend'] * 0.5 * RHO_REF * b['w_shunt']**2 + dp_ch_fric + b['dp_fiwihex'] + p_dyn_ch
        exh.append(avail - need)
    # --- hulpventilatoren (dimensionerend: slechtste verdieping)
    def_sup = max(0.0, -min(sup)); def_exh = max(0.0, -min(exh))
    P_fan = q_v * (def_sup + def_exh) / b['eta_fan']
    # --- pompen (§3.5.4)
    q_w = rwl * m_da / RHO_W
    head = H + b['p_nozzle'] / (RHO_W * G) + b['pipe_R'] * (H + 10) / (RHO_W * G) + b['dp_local'] / (RHO_W * G)
    P_spray = RHO_W * G * head * q_w / b['eta_pump']
    dT_src = max(1.0, abs(cas['tw'] - tw_in))
    P_src = abs(cas['Q']) / (CP_W * dT_src) / RHO_W * b['dp_source'] / b['eta_pump']
    cop = abs(cas['Q']) / (P_spray + P_src) if cooling and cas['Q'] < 0 else None
    return dict(q_v=q_v, m_da=m_da, A_c=A_c, persons=persons, mode='koelen' if cooling else 'verwarmen', rwl=rwl, note=note,
                cas=cas, t_sup=t_sup, x_sup=x_sup, Q_reheat=Q_reheat, x_room=x_room, rh_room=rh_from(t_room, x_room, p),
                Q_vent_sens=Q_vent_sens, Q_int=Q_int, chim=chim, chim_open=chim_open, Q_hr=Q_hr, vd=vd,
                dp_th_kc=dp_th_kc, sup=sup, exh=exh, P_fan=P_fan, P_spray=P_spray, P_src=P_src, cop=cop,
                def_sup=def_sup, def_exh=def_exh, dp_ch_fric=dp_ch_fric)

# ---------------------------------------------------------------- 6. Weerpresets (zie SPEC §6.3)
LAT, LON = 52.10, 5.18      # KNMI De Bilt (260)
PRESETS = [
    # id, naam, t [°C], RV [%], U10 [m/s], GHI [W/m²], dag v/h jaar, UTC-uur (midden uurvak), vaste gevelstraling [W/m²] of None
    ('ontwerp_zomer', 'Ontwerp zomer 28 °C / 55 %', 28.0, 55, 3.5, None, None, None, 400),
    ('gem_zomer', 'Gemiddelde zomerdag 20 °C / 80 %', 20.0, 80, 3.5, None, None, None, 400),
    ('hitte_2019', 'Hittegolf 25-07-2019 De Bilt', 37.1, 29, 3.0, 728, 206, 13.5, None),
    ('benauwd_2020', 'Benauwde zomerdag 12-08-2020', 31.3, 44, 3.0, 706, 225, 12.5, None),
    ('voorjaar_2023', 'Zonnige voorjaarsdag 15-03-2023', 8.1, 51, 3.0, 617, 74, 11.5, None),
    ('tussen', 'Tussenseizoen 10 °C / 99 %', 10.1, 99, 3.5, None, None, None, 150),
    ('gem_winter', 'Gemiddelde winterdag 5 °C / 90 %', 5.0, 90, 4.0, None, None, None, 80),
    ('zon_winter', 'Zonnige winterdag (testdag 15-12-2009)', 0.55, 80, 3.0, None, None, None, 730),
    ('koude_2021', 'Koude-inval 13-02-2021 09:30', -7.0, 75, 3.0, 217, 44, 8.5, None),
    ('ontwerp_winter', 'Ontwerp winter −10 °C / 90 %', -10.0, 90, 5.0, None, None, None, 0),
    ('storm_2022', 'Storm Eunice 18-02-2022', 11.0, 56, 13.0, 175, 49, 14.5, None),
    ('windstil', 'Windstil, bewolkt 20 °C', 20.0, 80, 0.8, None, None, None, 120),
]

def preset_weather(pr, surf_az=0.0):
    _, name, t, rh, U10, ghi, doy, utc, fixed = pr
    if fixed is not None:
        # vaste gevelstraling uit het proefschrift: totale straling op de schoorsteen, zonder invalshoekcorrectie
        return dict(t=t, rh=rh, p=P_STD, U10=U10, phi_beam=0.0, phi_diff=float(fixed), theta=0.0, angle_corr=False, name=name)
    alt, az, _ = sun_position(LAT, LON, utc, doy)
    beam, diff, th = erbs_hay_davies(ghi, alt, az, doy, surf_az, 90.0)
    return dict(t=t, rh=rh, p=P_STD, U10=U10, phi_beam=beam, phi_diff=diff, theta=th, angle_corr=True, name=name)

# ---------------------------------------------------------------- 7. Validatie + uitvoer
if __name__ == '__main__':
    print('=== Druppeleindsnelheid vs Gunn & Kinzer (1949)')
    for d, gk in ((0.5, 2.06), (1.0, 4.03), (1.5, 5.40), (2.0, 6.49), (3.0, 8.06)):
        print(f'  d={d} mm: {drop_terminal(d * 1e-3):.2f} m/s  (G&K {gk})')

    print('\n=== Klimaatcascade testopstelling Peutz (Bronsema tab. 3.4.7), H=5,5 m, A=1 m², d30=1,048 / d32=1,317 mm')
    B = [('B1', 27.34, 51.88, 1789, 0.673, 12.85, 16.85, 11.64, 15.11, 5.81),
         ('B2', 20.00, 77.73, 1832, 0.674, 13.03, 15.21, 10.87, 14.37, 6.18),
         ('B4', 10.08, 99.0, 1836, 0.670, 12.83, 11.60, 8.38, 12.13, 7.17),
         ('B3', 5.32, 95.27, 1836, 0.674, 13.10, 9.54, 7.149, 11.00, 8.44),
         ('B5', -3.70, 57.48, 1807, 0.674, 12.93, 5.78, 5.39, 8.50, 9.77)]
    for nm, ta, rh, V, mw, tw, tm, xm, twm, dpm in B:
        x = x_from_t_rh(ta, rh, P_STD); m_da = V / 3600 * rho_moist(ta, x, P_STD) / (1 + x)
        r = cascade(5.5, 1.0, m_da, ta, x, mw, tw, 1.048e-3, 1.317e-3)
        dp = r['dp_hydr'] + sum(G * abs(a['z'] - b_['z']) * (0.5 * (a['rho'] + b_['rho']) - rho_moist(20, 0.008, P_STD)) for a, b_ in zip(r['prof'][:-1], r['prof'][1:]))
        print(f"  {nm}: t_uit {r['t']:6.2f} (meting {tm:5.2f})  x {r['x']*1000:5.2f} ({xm:5.2f})  tw_uit {r['tw']:5.2f} ({twm:5.2f})  "
              f"Δp {dp:5.2f} Pa ({dpm})  balans {r['balance_err']*100:+.3f} %")

    print('\n=== Ware grootte 8 verd./28 m/40.000 m³/h/2 m/s (tab. 3.3.9/2) vs CFD')
    for nm, ta, rh, tw, rwl, ref in [('D1', 28, 55, 13, 1.17, 16.5), ('D3', 5, 90, 13, 1.07, 12.0), ('D4', -10, 90, 15, 1.00, 6.5)]:
        x = x_from_t_rh(ta, rh, 100e3); m_da = 40000 / 3600 * rho_moist(ta, x, 100e3) / (1 + x)
        r = cascade(28, 40000 / 3600 / 2, m_da, ta, x, rwl * m_da, tw, 1.048e-3, 1.317e-3, p=100e3)
        print(f"  {nm}: t_uit {r['t']:5.2f} °C / {r['rh']:3.0f} %  (CFD {ref})   hydraulische trek {r['dp_hydr']:5.1f} Pa")

    print('\n=== Ventecdak tab. 2.5.3 (U10 = 3,5 m/s, ρ = 1,229, U_ej = 1 m/s, c = 2 m)')
    for z, uref_t, pneg_t, ppos_t in [(15, 2.20, -0.64, 2.37), (30, 3.52, -2.68, 6.09), (50, 4.19, -4.32, 8.59)]:
        U = wind_at_height(3.5, z); cp, _ = cp_ejector(1.0, U); q = 0.5 * 1.229 * U**2
        print(f"  z={z}: U_ref {U:.2f} ({uref_t})  onderdruk {cp*q:.2f} ({pneg_t})  overdruk {0.8*q:.2f} ({ppos_t})")

    print('\n=== Zonneschoorsteen referentie 20 °C / 400 W/m², PT-glas, B 3,6 D 0,65 w 1,5 (thesis η ≈ 0,61–0,63; ΔT/verd ≈ 0,72 K)')
    for nv in (4, 8, 14):
        r = chimney(nv * 3.5, 3.6, 0.65, 3.6 * 0.65 * 1.5, 21, 20, 0.008, 0, 400, 0, angle_corr=False)
        print(f"  {nv:2d} verd: t_uit {r['t_out']:.2f}  η {r['eta']:.3f}  ΔT/verd {(r['t_out']-21)/nv:.2f}  trek {r['dp_th']:.1f} Pa")
    r = chimney(49, 3.6, 0.65, 3.6 * 0.65 * 1.5, 24, 32, 0.010, 0, 840, 0, g=0.75, U_glass=1.10, angle_corr=False)
    print(f"  extreem 32 °C/840 W/m², PS-glas, 14 verd: glas max {r['t_glass_max']:.1f} (thesis ≈ 60)  wand max {r['t_wall_max']:.1f} (≈ 73)")
    r = chimney(11, 2.0, 0.25, 0.5, 20.92, 0.55, 0.003, 0, 730, 0, U_glass=1.58, R=0.83, U_wall=0.235, angle_corr=False)
    print(f"  testopstelling 15-12-2009 (730 W/m², 0,55 °C): t_uit {r['t_out']:.1f} (meting 32,1)")

    print('\n=== Thermische trek, Bronsema §3.5.5.4/5 (formule 3.5.5/5–6, ρ0 = 1,293, T0 = 273 K, 10 verd.)')
    k = 12120
    print(f"  zomer voet: {k*10*(1/(273+22.5) - 1/(273+28)):.1f} Pa (thesis 7,5)   winter voet: {k*10*(1/(273-1.75) - 1/(273-10)):.1f} Pa (thesis −14,0)")

    print('\n=== Standaardkantoor (8 verd., 8000 m² AVO), alle presets — zonneschoorsteen zuid')
    b = DEFAULT_BUILDING
    print(f"  {'preset':38s} {'modus':9s} RW/L  t_toe  RV_uit  Q_cas   Q_na  RV_rm  Φgevel  t_zs   Q_zs  trek_zs  p_od  p_ej  min Δp_toe  min Δp_af  P_vent  P_pomp  COP")
    for pr in PRESETS:
        wx = preset_weather(pr, b['chim_az'])
        r = simulate(b, wx)
        print(f"  {wx['name']:38s} {r['mode']:9s} {r['rwl']:4.2f} {r['cas']['t']:6.1f} {r['cas']['rh']:6.0f} {r['cas']['Q']/1e3:7.0f} {r['Q_reheat']/1e3:6.0f} {r['rh_room']:5.0f} "
              f"{wx['phi_beam']+wx['phi_diff']:7.0f} {r['chim']['t_out']:5.1f} {r['chim']['Q']/1e3:6.0f} {r['chim']['dp_th']:7.1f} {r['vd']['p_over']:5.1f} {r['vd']['p_ej']:5.1f} "
              f"{min(r['sup']):10.1f} {min(r['exh']):10.1f} {r['P_fan']/1e3:7.2f} {r['P_spray']/1e3:7.2f} {('%.0f' % r['cop']) if r['cop'] else '—':>4s}")
    r = simulate(b, preset_weather(PRESETS[0]))
    print(f"\n  Ontwerp zomer: q_v = {r['q_v']*3600:.0f} m³/h, ṁ_da = {r['m_da']:.2f} kg/s, A_cascade = {r['A_c']:.2f} m², personen = {r['persons']:.0f}")
    print(f"  hydraulische trek {r['cas']['dp_hydr']:.1f} Pa, thermische trek cascade {r['dp_th_kc']:.1f} Pa, aerodyn. (info) {r['cas']['dp_aero']:.1f} Pa")
    print('  toevoer Δp-marge per verdieping (1→8):', ' '.join(f'{v:.0f}' for v in r['sup']))
    print('  afvoer  Δp-marge per verdieping (1→8):', ' '.join(f'{v:.1f}' for v in r['exh']))
    print(f"  FiWiHEx {r['Q_hr']/1e3:.0f} kW, zonneschoorsteen w = {r['chim']['w']:.2f} m/s, wrijving schoorsteen {r['dp_ch_fric']:.2f} Pa")
    print(f"  cascade-profiel (z, t, x, tw):", ' | '.join(f"{p_['z']:.0f} m {p_['t']:.1f} °C {p_['x']*1000:.1f} g/kg {p_['tw']:.1f}" for p_ in r['cas']['prof'][::50]))
    r = simulate(b, preset_weather(PRESETS[9]))
    print('\n  Ontwerp winter toevoer Δp per verd.:', ' '.join(f'{v:.0f}' for v in r['sup']), ' | afvoer:', ' '.join(f'{v:.1f}' for v in r['exh']))


# ---------------------------------------------------------------- 8. Orakel-export voor de JS-tests
def export_oracle(path='ewf-oracle.json'):
    """Schrijft referentie-uitkomsten naar JSON (test/fixtures/ewf-oracle.json in de repo)."""
    import json
    out = {'_info': 'Gegenereerd door docs/ewf/ewf_prototype.py — referentie voor regressietests (zie SPEC §12).',
           'cascade_testrig': [], 'cascade_fullscale': [], 'ventecdak_tab253': [], 'chimney_reference': [],
           'default_building': {}}
    B = [('B1', 27.34, 51.88, 1789, 0.673, 12.85), ('B2', 20.00, 77.73, 1832, 0.674, 13.03),
         ('B4', 10.08, 99.0, 1836, 0.670, 12.83), ('B3', 5.32, 95.27, 1836, 0.674, 13.10),
         ('B5', -3.70, 57.48, 1807, 0.674, 12.93)]
    for nm, ta, rh, V, mw, tw in B:
        x = x_from_t_rh(ta, rh, P_STD); m_da = V / 3600 * rho_moist(ta, x, P_STD) / (1 + x)
        r = cascade(5.5, 1.0, m_da, ta, x, mw, tw, 1.048e-3, 1.317e-3)
        out['cascade_testrig'].append(dict(id=nm, input=dict(H=5.5, Ac=1.0, Vm3h=V, tIn=ta, rhIn=rh, mW=mw, tWIn=tw, d30=1.048e-3, d32=1.317e-3, w0=10, N=400, p=P_STD),
                                           mDa=m_da, tOut=r['t'], xOut=r['x'], twOut=r['tw'], dpHydr=r['dp_hydr'], Q=r['Q']))
    for nm, ta, rh, tw, rwl in [('D1', 28, 55, 13, 1.17), ('D3', 5, 90, 13, 1.07), ('D4', -10, 90, 15, 1.00)]:
        x = x_from_t_rh(ta, rh, 100e3); m_da = 40000 / 3600 * rho_moist(ta, x, 100e3) / (1 + x)
        r = cascade(28, 40000 / 3600 / 2, m_da, ta, x, rwl * m_da, tw, 1.048e-3, 1.317e-3, p=100e3)
        out['cascade_fullscale'].append(dict(id=nm, input=dict(H=28, Ac=40000 / 3600 / 2, Vm3h=40000, tIn=ta, rhIn=rh, rwl=rwl, tWIn=tw, p=100e3),
                                             mDa=m_da, tOut=r['t'], rhOut=r['rh'], dpHydr=r['dp_hydr']))
    for z in (15, 20, 25, 30, 35, 40, 45, 50):
        U = wind_at_height(3.5, z); cp, _ = cp_ejector(1.0, U); q = 0.5 * 1.229 * U**2
        out['ventecdak_tab253'].append(dict(z=z, Uref=U, pNeg=cp * q, pPos=0.8 * q))
    for nv in (4, 6, 8, 10, 14):
        r = chimney(nv * 3.5, 3.6, 0.65, 3.6 * 0.65 * 1.5, 21, 20, 0.008, 0, 400, 0, angle_corr=False)
        out['chimney_reference'].append(dict(floors=nv, tOut=r['t_out'], eta=r['eta'], dpTh=r['dp_th']))
    b = DEFAULT_BUILDING
    for pr in PRESETS:
        wx = preset_weather(pr, b['chim_az']); r = simulate(b, wx)
        out['default_building'][pr[0]] = dict(
            weather=dict(t=wx['t'], rh=wx['rh'], U10=wx['U10'], phiBeam=wx['phi_beam'], phiDiff=wx['phi_diff'], theta=wx['theta'], angleCorr=wx['angle_corr']),
            mode=r['mode'], rwl=r['rwl'], tCascadeOut=r['cas']['t'], rhCascadeOut=r['cas']['rh'], Qcascade=r['cas']['Q'],
            Qreheat=r['Q_reheat'], rhRoom=r['rh_room'], tChimneyOut=r['chim']['t_out'], Qchimney=r['chim']['Q'],
            dpChimney=r['chim']['dp_th'], pOver=r['vd']['p_over'], pEj=r['vd']['p_ej'], dpHydr=r['cas']['dp_hydr'],
            dpThCascade=r['dp_th_kc'], supplyMargin=r['sup'], exhaustMargin=r['exh'], Pfan=r['P_fan'],
            Pspray=r['P_spray'], Psource=r['P_src'], COP=r['cop'], qV=r['q_v'], mDa=r['m_da'], QfiWiHex=r['Q_hr'])
    with open(path, 'w') as f:
        json.dump(out, f, indent=1, ensure_ascii=False)
    return path

if __name__ == '__main__':
    print('\nOrakel geschreven naar', export_oracle())
