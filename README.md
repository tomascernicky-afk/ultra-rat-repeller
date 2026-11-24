# ULTRA RAT REPELLER — PREMIUM ULTRASONIC ENGINE

Profesionální, moderní a funkční webová PWA aplikace určená k experimentálnímu odpuzování hlodavců (potkanů a krys) pomocí dynamicky proměnlivého ultrazvukového signálu v primárním rozsahu **22 000 Hz až 25 000 Hz**.

---

## ⚡ Implementovaný Audio Engine (`js/audio-engine.js`)

Audio engine je postaven přímo na nativním **Web Audio API** standardu W3C:

### 1. Skutečné generování zvukového signálu
- Signál je fyzicky syntetizován v reálném čase prostřednictvím `OscillatorNode` (čistá sinusoida `type = 'sine'`), napojeného na dynamický obálkový zesilovač `envelopeGain`, hlavní regulátor amplitudy `masterGain`, bezpečnostní limiter `DynamicsCompressorNode`, spektrální analyzátor `AnalyserNode` a cílové zařízení `AudioContext.destination`.
- **Není použita žádná simulace ani přehrávání přednahraných vzorků**.

### 2. Frekvenční rozsah 22 000 Hz – 25 000 Hz
- Výchozí a primární pracovní frekvence je v rozsahu **22 000 Hz až 25 000 Hz**.
- Možnost manuálního nastavení i procedurálního řízení.
- Implementována automatická hardwarová ochrana proti překročení Nyquistova kmitočtu kodeku ($f_s / 2$), zabraňující aliasingu.

### 3. Plynulé změny frekvence & Frekvenční sweep
- `setFrequency(freq, rampDuration)`: plynulý frekvenční přechod (gliding) v milisekundách bez akustických artefaktů.
- `scheduleSweep(startFreq, endFreq, duration, curve)`: lineární i exponenciální sweeps s volitelnou dobou trvání a strmostí.

### 4. Řízení amplitudy a ochrana proti kliknutí (Zero-Click)
- `setIntensity(level)`: řízení amplitudy od 5 % do 100 % s 20ms plynulou rampou.
- `setEmissionActive(active, duration)`: obálka s nastavitelným náběhem (Attack 12 ms) a doběhem (Release 15 ms), které eliminují DC offset a lupance.
- `DynamicsCompressorNode`: aktivní brickwall limiter chránící audio převodník před digitálním ořezem při vysokých amplitudách.

### 5. Okamžité zastavení zvuku
- `immediateStop()` / `emergencyKill()`: okamžitě zruší všechny naplánované parametry (`cancelScheduledValues`), nastaví zisk na nulu a odpojí oscilátor bez zpoždění.

### 6. Správa životního cyklu AudioContext a ošetření chyb
- Správné odemknutí kontextu při prvním gestu uživatele (`resume()`).
- Detekce stavů `running`, `suspended`, `closed`.
- Detekce změn audio zařízení přes `navigator.mediaDevices.ondevicechange`.
- Ošetření chyb a vizualizace stavu v UI.

### 7. Příprava pro další etapu (dynamické sekvence)
Engine obsahuje předpřipravené asynchronní metody:
- `playTone(freq, duration, attack, release)`
- `playSweep(fromFreq, toFreq, duration)`
- `playBurst(freq, pulseDur, gapDur, repeat)`

---

## 🖥️ Zobrazení v UI

V uživatelském rozhraní jsou trvale k dispozici:
- **Aktuální frekvence**: v Hz s dynamickým pruhovým ukazatelem polohy v pásmu 22–25 kHz.
- **Aktuální stav audio enginu**: `AKTIVNÍ (23 500 Hz)`, `PŘIPRAVEN (READY)`, `POZASTAVEN`, `ZASTAVENO`.
- **Informace o aktivitě emise**: svítící indikátor aktivního vysílání signálu.
- **START** a **STOP** centrální tlačítka i pohotovostní nouzový vypínač.
- **Frekvenční rozsah**: explicitně vyznačený rozsah 22 000 – 25 000 Hz.
- **Manuální kalibrace a testovací sweep**: umožňuje okamžité vyzkoušení plynulých změn a sweepu 22 $\rightarrow$ 25 kHz nezávisle na automatických cyklech.

---

## ⚠️ Technická a biologická poznámka

Software generuje frekvenci 22 000 až 25 000 Hz v plné digitální přesnosti. Běžné miniaturní reproduktory telefonů mají fyzický akustický útlum nad 18–20 kHz. Pro reálné akustické vyzáření ultrazvuku je doporučeno připojit externí piezoelektrický transducer.
