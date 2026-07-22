// ============================================================
// Svatební web — JavaScript
// Vše je "progressive enhancement": bez JS web plně funguje,
// jen chybí odpočet a animace.
// ============================================================

const bezPohybu = window.matchMedia("(prefers-reduced-motion: reduce)").matches;

document.addEventListener("DOMContentLoaded", () => {

  // ------------------------------------------------------------
  // 0. Úvodní přechod (M & M jako rostoucí díra do hero)
  //
  //    Jedna hodnota "progress" na animační snímek řídí VŠE. M&M je
  //    transparentní otvor už od prvního snímku — žádná viditelná
  //    "tmavá" kopie ani crossfade barvy.
  //
  //    Zjednodušené řešení, ~1,4 s celkem:
  //    1) Celou dobu běží čistě SCALE (jeden řetězec SVG transformace
  //       na #introMaskUse) — žádná dilatace, žádné vrstvy navíc,
  //       maska je jen fill. Křivka zrychlování: pomalý, ale nenulový
  //       start → plynulá kontinuální akcelerace → nejrychlejší konec.
  //    2) Od chvíle, kdy M&M vizuálně zabírá většinu obrazovky (ještě
  //       čitelné jako logo), scale dál pokračuje (nikdy se nezastaví)
  //       a SOUČASNĚ se jednou jedinou opacity změnou na celém #intro
  //       plynule "rozpustí" zbývající krémové okolí — stejný pohyb,
  //       ne druhá animace. Kompozitorová vlastnost na jednom prvku —
  //       nejlevnější možná operace, žádné přepočítávání SVG geometrie
  //       za běhu.
  //
  //    JS jen navíc: (a) počká na konkrétní web font použitý v M&M
  //    (ne na všechny fonty stránky), ať se tvar uprostřed neplete,
  //    (b) po dobu běhu zamkne scroll BEZ layout shiftu a schová
  //    navigaci/hero text/scroll-cue, (c) po dohrání intro odstraní
  //    z DOM a teprve POTÉ spustí původní vstupní animaci hero textu
  //    (viz sekce 16 v CSS, "vstup"), (d) při omezení pohybu nebo
  //    chybějící podpoře CSS masky přepne na jednoduché krátké
  //    prolnutí bez zoomu.
  // ------------------------------------------------------------
  const intro = document.getElementById("intro");
  if (intro) {
    const HOLD = 100;          // ms téměř nepostřehnutelného klidu na startu
    const DELKA_RUSTU = 1300;  // ms — samotný plynulý růst (celkem ≈ 1,4 s)
    const CEKANI_NA_FONT = 150; // bezpečný strop pro JEDEN konkrétní font řez

    const introMaskUse = document.getElementById("introMaskUse");

    const maskySwPodporovane =
      typeof CSS !== "undefined" &&
      CSS.supports &&
      (CSS.supports("mask-image", "url(#x)") ||
        CSS.supports("-webkit-mask-image", "url(#x)"));

    const zjednodusit = bezPohybu || !maskySwPodporovane || !introMaskUse;

    // Kompenzace scrollbaru: `scrollbar-gutter: stable` (viz CSS) řeší
    // moderní prohlížeče samo; tady jen zjišťujeme, jestli je potřeba
    // JS fallback (starší Safari apod.) — měřeno JEDNOU, před zamčením
    // scrollu, aby hodnota odpovídala běžnému (nezamčenému) stavu.
    const scrollbarGutterOk =
      typeof CSS !== "undefined" &&
      CSS.supports &&
      CSS.supports("scrollbar-gutter", "stable");
    const sirkaScrollbaru = scrollbarGutterOk
      ? 0
      : window.innerWidth - document.documentElement.clientWidth;

    document.body.classList.add("intro-running");
    if (!scrollbarGutterOk && sirkaScrollbaru > 0) {
      document.body.style.paddingRight = sirkaScrollbaru + "px";
    }

    const uklidit = () => {
      intro.remove();
      document.body.classList.remove("intro-running");
      document.body.style.paddingRight = "";
      // Původní vstupní animace hero textu (CSS "vstup", viz sekce 16)
      // je gatovaná za touto třídou — spustí se tak čerstvě až TEĎ,
      // ne neviditelně během běhu intra.
      document.body.classList.add("hero-enter");
    };

    // Akcelerující křivka s NENULOVOU počáteční rychlostí (derivace
    // v t=0 je 0.15 — pohyb je znatelný hned od prvního snímku, žádné
    // "zaseknutí"). Lineární + kvadratický + kubický člen dohromady
    // dávají výraznější oblouk než čistá kvadratika: začátek je záměrně
    // pomalejší (uživatel stihne přečíst "M & M"), střední fáze plynule
    // zrychluje a poslední třetina je nejrychlejší — bez zlomu mezi
    // fázemi, protože jde o jednu spojitou funkci. V t=1 přesně 1.
    const easeAkceleruj = (t) => 0.15 * t + 0.25 * t * t + 0.6 * t * t * t;

    const animovat = () => {
      // Rozměry se čtou JEDNOU, před startem smyčky — v samotném
      // requestAnimationFrame se getBoundingClientRect ani jiný
      // vynucený layout nikdy nevolá (kvůli výkonu).
      const rect = intro.getBoundingClientRect();
      const cx = rect.width / 2;
      const cy = rect.height / 2;

      // SCALE_MAX odvozený od skutečné velikosti obrazovky: cílem je,
      // aby ve chvíli, kdy se rozjede závěrečný fade, už jednotlivé
      // tahy "M & M" byly výrazně větší než viewport. Odhad šířky
      // nápisu při scale 1 = font-size × ~2,4 (poměr "M & M" v
      // použitém řezu). Výsledek omezen na 18–25.
      const fontSizePx =
        parseFloat(getComputedStyle(introMaskUse).fontSize) || 70;
      const logoSirka = fontSizePx * 2.4;
      const potrebnyScale =
        (Math.max(rect.width, rect.height) * 1.6) / logoSirka;
      const SCALE_MAX = Math.min(25, Math.max(18, potrebnyScale));

      // Počáteční velikost: na mobilu M&M startuje 2× menší (stejný
      // breakpoint 999px jako zbytek webu — viz .nav-burger, hero-mobile
      // apod.). Konečná velikost (SCALE_MAX), střed růstu, délka i
      // křivka zůstávají stejné — mobil jen projde větším rozsahem.
      const jeMobil = window.matchMedia("(max-width: 999px)").matches;
      const START_SCALE = jeMobil ? 0.5 : 1;

      const zacatek = performance.now();

      const krok = (ted) => {
        const uplynulo = ted - zacatek;

        if (uplynulo < HOLD) {
          requestAnimationFrame(krok);
          return;
        }

        // t = reálný, lineární postup v čase (0–1) — na něm stavíme
        // časování závěrečného fade, aby sedělo na skutečné sekundy,
        // ne na zakřivenou "eased" škálu.
        const t = Math.min(1, (uplynulo - HOLD) / DELKA_RUSTU);
        const scale = START_SCALE + (SCALE_MAX - START_SCALE) * easeAkceleruj(t);

        // 1) Jedna transformace na #introMaskUse — scale pokračuje
        //    plynule až do úplného konce (t=1), nikdy se nezastaví
        //    dřív, ani během závěrečného fade.
        introMaskUse.setAttribute(
          "transform",
          `translate(${cx} ${cy}) scale(${scale}) translate(${-cx} ${-cy})`
        );

        // 2) Dokončení revealu = JEDNA opacity změna na celém #intro,
        //    ne geometrie navíc — scale se kvůli ní nikde nezastavuje
        //    ani nemění, je to stejný pohyb, jen s přidaným průhledem.
        //    FADE_START posunut na polovinu předchozí hodnoty (0.68 →
        //    0.34), fade tak dostává cca 860 ms reálného času — začíná
        //    dřív a trvá déle. Smoothstep má nulovou derivaci na obou
        //    koncích, takže těsně po FADE_START je průhled ještě prakticky
        //    neznatelný (M&M je krátce čitelné na plné krémové ploše) a
        //    pak plynule sílí až do opacity 0 přesně v t=1.
        const FADE_START = 0.34;
        const uf = Math.max(0, Math.min(1, (t - FADE_START) / (1 - FADE_START)));
        const smoothFade = uf * uf * (3 - 2 * uf);
        intro.style.opacity = 1 - smoothFade;

        if (t < 1) {
          requestAnimationFrame(krok);
        } else {
          // t=1 → intro.style.opacity je přesně 0 (viz výpočet výše).
          // Než #intro smažeme, počkáme na DVA požadavky
          // requestAnimationFrame — standardní záruka, že prohlížeč
          // tento zcela průhledný snímek skutečně vykreslil. Teprve
          // pak je odstranění vizuálně neznatelné.
          requestAnimationFrame(() => {
            requestAnimationFrame(() => {
              setTimeout(uklidit, 60);
            });
          });
        }
      };

      requestAnimationFrame(krok);
    };

    const spustit = () => {
      if (zjednodusit) {
        intro.classList.add("intro-simple", "intro-go");
        setTimeout(uklidit, 450);
        return;
      }
      animovat();
    };

    // Čekáme JEN na konkrétní font/řez použitý v M&M (Cormorant
    // Garamond, běžný řez), ne na všechny fonty stránky — waiting na
    // document.fonts.ready by čekalo i na Jost apod., což je zbytečně
    // dlouhé a přispívalo k pocitu "zaseknutí" na startu. Krátký
    // 150ms strop pro jistotu, ať intro nikdy nečeká donekonečna.
    if (document.fonts && document.fonts.load) {
      Promise.race([
        document.fonts.load('400 100px "Cormorant Garamond"').catch(() => {}),
        new Promise((vyres) => setTimeout(vyres, CEKANI_NA_FONT)),
      ]).then(spustit);
    } else {
      spustit(); // starší prohlížeče bez Font Loading API
    }
  }

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
  // 5. Mobilní menu (hamburger)
  // ------------------------------------------------------------
  const burger = document.querySelector(".nav-burger");
  const menu = document.querySelector(".menu");

  if (burger && menu) {
    const prepniMenu = (otevrit) => {
      menu.classList.toggle("open", otevrit);
      burger.classList.toggle("open", otevrit);
      burger.setAttribute("aria-expanded", String(otevrit));
      burger.setAttribute("aria-label", otevrit ? "Zavřít menu" : "Otevřít menu");
      document.body.classList.toggle("menu-otevrene", otevrit);
      document.body.style.overflow = otevrit ? "hidden" : ""; // zámek scrollu
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
