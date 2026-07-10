// ============================================================
// Svatební web — JavaScript
// Vše je "progressive enhancement": bez JS web plně funguje,
// jen chybí odpočet a animace.
// ============================================================

const bezPohybu = window.matchMedia("(prefers-reduced-motion: reduce)").matches;

document.addEventListener("DOMContentLoaded", () => {

  // ------------------------------------------------------------
  // 1. Odpočet do svatby (prolog)
  // ------------------------------------------------------------
  const odpocet = document.getElementById("odpocet");
  if (odpocet) {
    const svatba = new Date(2027, 3, 24); // měsíce od 0 → 3 = duben
    const dnes = new Date();
    svatba.setHours(0, 0, 0, 0);
    dnes.setHours(0, 0, 0, 0);
    const dni = Math.round((svatba - dnes) / 86400000);
    if (dni >= 0) {
      // České skloňování: 1 den, 2–4 dny, 5+ dní
      const tvar = dni === 1 ? "den" : dni >= 2 && dni <= 4 ? "dny" : "dní";
      odpocet.textContent = dni === 0 ? "je to dnes! · " : `za ${dni} ${tvar} · `;
    }
  }

  // ------------------------------------------------------------
  // 2. Jemné odhalení obsahu při scrollu (fade-up)
  //    Třída .reveal se přidává až tady — bez JS nic neskrýváme.
  // ------------------------------------------------------------
  if (!bezPohybu && "IntersectionObserver" in window) {
    const bloky = document.querySelectorAll(
      // Pozor: nikdy neanimovat celé sekce s vlastním pozadím (např. .prolog) —
      // reveal by skryl i barvu pozadí a stránka by "probleskovala"
      ".prolog-line, .prolog-meta, .section, .misto-media, .misto-body, .mezihra, .palette, .finale-content"
    );

    const io = new IntersectionObserver((zaznamy) => {
      for (const z of zaznamy) {
        if (z.isIntersecting) {
          z.target.classList.add("visible");
          io.unobserve(z.target); // každý blok se odhalí jen jednou
        }
      }
    }, { rootMargin: "0px 0px -12% 0px" });

    bloky.forEach((blok) => {
      blok.classList.add("reveal");
      io.observe(blok);
    });
  }

  // ------------------------------------------------------------
  // 3. Jemný parallax velkých fotografií (předěl, finále)
  //    Fotka je zvětšená na 110 % a posouvá se o ±4 % výšky.
  // ------------------------------------------------------------
  if (!bezPohybu) {
    const fotky = document.querySelectorAll(".hero-photo img, .predel img, .finale-photo");
    if (fotky.length) {
      let cekam = false;

      const posun = () => {
        cekam = false;
        const vyskaOkna = window.innerHeight;
        fotky.forEach((img) => {
          const r = img.parentElement.getBoundingClientRect();
          if (r.bottom < 0 || r.top > vyskaOkna) return; // mimo obrazovku
          // -1 až 1 podle toho, kde je střed fotky vůči středu okna
          const pozice = (r.top + r.height / 2 - vyskaOkna / 2) / vyskaOkna;
          img.style.transform = `scale(1.1) translateY(${(-pozice * 4).toFixed(2)}%)`;
        });
      };

      window.addEventListener("scroll", () => {
        if (!cekam) {
          cekam = true;
          requestAnimationFrame(posun); // max. jednou za snímek
        }
      }, { passive: true });

      posun();
    }
  }

  // ------------------------------------------------------------
  // 4. Plynulé otevírání a zavírání fotogalerií (details.galerie)
  //    Prohlížeč umí <details> zavřít jen skokově, proto výšku
  //    animujeme sami. Při prefers-reduced-motion necháme výchozí
  //    okamžité chování.
  // ------------------------------------------------------------
  if (!bezPohybu) {
    document.querySelectorAll("details.galerie").forEach((galerie) => {
      const spoustec = galerie.querySelector("summary");
      const obsah = galerie.querySelector(".galerie-grid");
      if (!spoustec || !obsah) return;

      spoustec.addEventListener("click", (udalost) => {
        udalost.preventDefault();
        if (galerie.dataset.animuje) return; // ignoruj klik během animace
        galerie.dataset.animuje = "1";

        if (galerie.open) {
          // Zavírání: nejdřív plynule složit, teprve potom zavřít
          obsah.style.maxHeight = obsah.scrollHeight + "px";
          requestAnimationFrame(() => {
            obsah.style.maxHeight = "0px";
            obsah.style.opacity = "0";
          });
          setTimeout(() => {
            galerie.open = false;
            obsah.style.maxHeight = "";
            obsah.style.opacity = "";
            delete galerie.dataset.animuje;
          }, 620);
        } else {
          // Otevírání: otevřít složené a plynule rozvinout
          galerie.open = true;
          obsah.style.maxHeight = "0px";
          obsah.style.opacity = "0";
          requestAnimationFrame(() => {
            obsah.style.maxHeight = obsah.scrollHeight + "px";
            obsah.style.opacity = "1";
          });
          setTimeout(() => {
            obsah.style.maxHeight = ""; // uvolnit pro responzivní změny
            obsah.style.opacity = "";
            delete galerie.dataset.animuje;
          }, 620);
        }
      });
    });
  }

  // ------------------------------------------------------------
  // 5. Mobilní menu — vlaštovky
  //
  // Princip: klidový stav každého ptáka je jeho vlastní cesta,
  // ze které je přes stroke-dasharray vidět jen prvních 24 px —
  // přesně čárka hamburgeru. Otevření: čáry se jedním tahem
  // dokreslí do dvou vlaštovek (pohled shora), ty krátce proletí
  // podél horní hrany karty a v rohu se stáhnou zpět do čar,
  // které se přitom pootočí o ±45° = křížek. Vše je jedna cesta,
  // nikdy se nic nevyměňuje.
  // ------------------------------------------------------------
  const burger = document.querySelector(".nav-burger");
  const menu = document.querySelector(".menu");
  const mpSvg = document.querySelector(".menu-ptaci");

  // Vlaštovka (pohled shora, zobák vpravo): čárka = linie hřbetu.
  // Křídla mají dvě ručně navržené polohy — mezi nimi se plynule přechází.
  const mpPtaci = [
    {
      poz: document.getElementById("mpPoz1"),
      rot: document.getElementById("mpRot1"),
      p: document.getElementById("mpP1"),
      homeY: -18.25, // čárka nahoře
      uhelX: 45,
      per: 520,
      // [dolní křídlo A, dolní B, horní A, horní B] — 12 čísel na křídlo
      kD_A: [46, 68, 40, 80, 32, 90, 40, 79, 46, 68, 50, 58],
      kD_B: [47, 65, 43, 74, 38, 82, 44, 74, 48, 66, 51, 57],
      kH_A: [50, 36, 48, 24, 44, 12, 52, 22, 56, 34, 58, 44],
      kH_B: [51, 39, 50, 30, 48, 20, 54, 28, 57, 37, 58, 45],
    },
    {
      poz: document.getElementById("mpPoz2"),
      rot: document.getElementById("mpRot2"),
      p: document.getElementById("mpP2"),
      homeY: -9.75, // čárka dole
      uhelX: -45,
      per: 610,
      // druhý pták: křídla o kus rozevřenější — pár, ne kopie
      kD_A: [45, 70, 38, 83, 29, 94, 38, 81, 45, 69, 50, 58],
      kD_B: [47, 66, 42, 76, 36, 85, 43, 75, 48, 67, 51, 57],
      kH_A: [49, 35, 46, 22, 41, 9, 50, 20, 55, 33, 58, 44],
      kH_B: [51, 38, 49, 28, 46, 17, 53, 26, 56, 36, 58, 45],
    },
  ];

  const MP_X = 196;   // vodorovná pozice čárek (střed tlačítka v plátně 300 px)
  const MP_XY = -14;  // svislá pozice středu křížku

  const mpLerp = (a, b, t) => a + (b - a) * t;
  const mpEase = (t) => (t < 0.5 ? 2 * t * t : 1 - Math.pow(-2 * t + 2, 2) / 2);

  // Sestaví cestu vlaštovky; s = poloha křídel (0 rozpětí, 1 přivřená)
  function mpSilueta(pt, s) {
    const d = pt.kD_A.map((v, i) => mpLerp(v, pt.kD_B[i], s).toFixed(1));
    const h = pt.kH_A.map((v, i) => mpLerp(v, pt.kH_B[i], s).toFixed(1));
    return (
      "M 60 46 L 84 46 " +                            // čárka = hřbet
      "C 88 45 92 44 95 42 L 100 41 " +               // hlava a zobák
      "C 95 46 91 47 87 48 " +                        // bradička
      "C 76 52 64 55 52 57 " +                        // bříško
      `C ${d.slice(0, 6).join(" ")} ` +               // dolní křídlo tam
      `C ${d.slice(6, 12).join(" ")} ` +              // dolní křídlo zpět
      "L 18 68 L 40 57 L 14 52 " +                    // vidlicový ocas
      "C 30 50 42 48 52 47 " +                        // zpět k hřbetu
      `C ${h.slice(0, 6).join(" ")} ` +               // horní křídlo tam
      `C ${h.slice(6, 12).join(" ")}`                 // horní křídlo zpět
    );
  }

  function mpStav(pt, o) {
    // o = {x, y, uhel, kresba (0–1 podíl viditelné cesty), s}
    pt.p.setAttribute("d", mpSilueta(pt, o.s));
    const L = pt.p.getTotalLength();
    pt.p.style.strokeDasharray = L;
    // kresba 0 → vidět jen prvních 24 px (čárka); 1 → celá silueta
    pt.p.style.strokeDashoffset = (L - 24) * (1 - o.kresba);
    pt.poz.setAttribute("transform", `translate(${o.x} ${o.y})`);
    pt.rot.setAttribute("transform", `rotate(${o.uhel} 72 46)`);
  }

  const mpBurger = (pt) => ({ x: MP_X, y: pt.homeY, uhel: 0, kresba: 0, s: 0 });
  const mpKrizek = (pt) => ({ x: MP_X, y: MP_XY, uhel: pt.uhelX, kresba: 0, s: 0 });

  let mpRaf = null;

  function mpTimeline(kroky, hotovo) {
    // kroky: pole fází {do, akce(f, pt, i)} — f je 0–1 v rámci fáze
    cancelAnimationFrame(mpRaf);
    const t0 = performance.now();
    const konec = kroky[kroky.length - 1].do;
    function tik(cas) {
      const t = cas - t0;
      const faze = kroky.find((k) => t < k.do);
      if (!faze) {
        hotovo && hotovo();
        return;
      }
      const od = kroky[kroky.indexOf(faze) - 1]?.do || 0;
      const f = (t - od) / (faze.do - od);
      mpPtaci.forEach((pt, i) => faze.akce(f, pt, i));
      mpRaf = requestAnimationFrame(tik);
    }
    mpRaf = requestAnimationFrame(tik);
  }

  // Bod na malém obloučku letu (podél horní hrany karty, mimo text)
  function mpLet(pt, i, u) {
    const body = [
      [MP_X, pt.homeY], [130 - i * 14, 4 + i * 16],
      [58 - i * 10, 34 + i * 14], [120 - i * 8, 20 + i * 10],
      [MP_X, MP_XY],
    ];
    const n = body.length - 1;
    const seg = Math.min(Math.floor(u * n), n - 1);
    const g = u * n - seg;
    const gg = mpEase(g);
    return {
      x: mpLerp(body[seg][0], body[seg + 1][0], gg),
      y: mpLerp(body[seg][1], body[seg + 1][1], gg),
    };
  }

  function mpOtevri(hotovo) {
    mpTimeline([
      { do: 1150, akce: (f, pt, i) => { // 1) dokreslení jedním tahem
        const ff = Math.max(0, Math.min(1, (f * 1150 - i * 140) / 950));
        mpStav(pt, { x: MP_X, y: pt.homeY, uhel: 0, kresba: mpEase(ff), s: 0 });
      } },
      { do: 2300, akce: (f, pt, i) => { // 2) krátký let + jemné mávnutí
        const u = Math.max(0, Math.min(1, (f * 1150 - i * 110) / 1040));
        const b = mpLet(pt, i, u);
        const cyk = ((f * 1150 + i * 160) % pt.per) / pt.per;
        const s = cyk < 0.42
          ? mpLerp(0.06, 0.5, mpEase(cyk / 0.42))
          : mpLerp(0.5, 0.06, mpEase((cyk - 0.42) / 0.58));
        mpStav(pt, { x: b.x, y: b.y, uhel: mpLerp(0, -8 + i * 16, Math.sin(u * Math.PI)), kresba: 1, s });
      } },
      { do: 2850, akce: (f, pt) => { // 3) stažení do čárky + otočení = ×
        const e = mpEase(f);
        mpStav(pt, {
          x: MP_X,
          y: MP_XY, // let končí přesně ve středu budoucího křížku
          uhel: mpLerp(0, pt.uhelX, e),
          kresba: 1 - e,
          s: mpLerp(0.06, 0, e),
        });
      } },
    ], hotovo);
  }

  function mpZavri(hotovo) {
    mpTimeline([
      { do: 420, akce: (f, pt) => { // 1) × se uvolní: pootočí zpět a dokreslí půl ptáka
        const e = mpEase(f);
        mpStav(pt, { x: MP_X, y: MP_XY, uhel: mpLerp(pt.uhelX, 0, e), kresba: mpLerp(0, 0.55, e), s: 0.1 });
      } },
      { do: 850, akce: (f, pt, i) => { // 2) krátké mávnutí a přesun na místo čárky
        const e = mpEase(f);
        const s = 0.1 + Math.sin(Math.min(1, f) * Math.PI) * 0.35;
        mpStav(pt, { x: MP_X - Math.sin(f * Math.PI) * (14 + i * 6), y: mpLerp(MP_XY, pt.homeY, e), uhel: 0, kresba: 0.55, s });
      } },
      { do: 1300, akce: (f, pt) => { // 3) stažení zpět do čisté čárky
        const e = mpEase(f);
        mpStav(pt, { x: MP_X, y: pt.homeY, uhel: 0, kresba: mpLerp(0.55, 0, e), s: mpLerp(0.1, 0, e) });
      } },
    ], hotovo);
  }

  if (burger && menu) {
    const maPtaky = () =>
      !bezPohybu && mpSvg && getComputedStyle(mpSvg).display !== "none";

    // Výchozí klidový stav: čárky hamburgeru
    if (mpSvg) mpPtaci.forEach((pt) => mpStav(pt, mpBurger(pt)));

    const prepniMenu = (otevrit) => {
      menu.classList.toggle("open", otevrit);
      burger.setAttribute("aria-expanded", String(otevrit));
      burger.setAttribute("aria-label", otevrit ? "Zavřít menu" : "Otevřít menu");
      document.body.classList.toggle("menu-otevrene", otevrit);
      document.body.style.overflow = otevrit ? "hidden" : "";

      if (maPtaky()) {
        // Přerušený běh: skoč do výchozího stavu nové animace (klik funguje vždy)
        cancelAnimationFrame(mpRaf);
        if (otevrit) {
          mpPtaci.forEach((pt) => mpStav(pt, mpBurger(pt)));
          mpOtevri(() => mpPtaci.forEach((pt) => mpStav(pt, mpKrizek(pt))));
        } else {
          mpPtaci.forEach((pt) => mpStav(pt, mpKrizek(pt)));
          mpZavri(() => mpPtaci.forEach((pt) => mpStav(pt, mpBurger(pt))));
        }
      } else {
        burger.classList.toggle("open", otevrit); // fallback: spany
      }
    };

    burger.addEventListener("click", () => {
      prepniMenu(!menu.classList.contains("open"));
    });

    // Klik na kapitolu menu zavře a nechá prohlížeč doscrollovat
    menu.querySelectorAll("a").forEach((odkaz) => {
      odkaz.addEventListener("click", () => prepniMenu(false));
    });
  }

  // ------------------------------------------------------------
  // 6. Zvýraznění aktivní kapitoly v desktopové navigaci
  // ------------------------------------------------------------
  if ("IntersectionObserver" in window) {
    const odkazy = document.querySelectorAll(".nav-links a[href^='#']");
    if (odkazy.length) {
      const spy = new IntersectionObserver((zaznamy) => {
        zaznamy.forEach((z) => {
          const odkaz = document.querySelector(
            `.nav-links a[href="#${z.target.id}"]`
          );
          if (odkaz) odkaz.classList.toggle("active", z.isIntersecting);
        });
      }, { rootMargin: "-40% 0px -55% 0px" }); // aktivní = kapitola u středu okna

      odkazy.forEach((odkaz) => {
        const cil = document.querySelector(odkaz.getAttribute("href"));
        if (cil) spy.observe(cil);
      });
    }
  }
});
