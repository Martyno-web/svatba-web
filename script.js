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
  // 5. Mobilní menu (hamburger) + let vlaštovek
  //    Otevření: čárky hamburgeru se promění ve dva ptáčky, ti
  //    obletí otevírající se kartu a v rohu se pomalu složí do ×.
  // ------------------------------------------------------------
  const burger = document.querySelector(".nav-burger");
  const menu = document.querySelector(".menu");
  const ptaci = document.querySelectorAll(".ptak");

  const umimLetet = () =>
    !bezPohybu &&
    ptaci.length === 2 &&
    typeof ptaci[0].animate === "function" &&
    CSS.supports("offset-path", "path('M 0 0 L 1 1')");

  const letVlastovek = (hotovo) => {
    const w = window.innerWidth;
    const h = window.innerHeight;
    const sx = w - 44; // start i cíl: pozice hamburgeru vpravo nahoře
    const sy = 32;

    // Dvě mírně odlišné smyčky přes kartu menu a zpět do rohu
    const drahy = [
      `M ${sx} ${sy}
       C ${w * 0.5} ${h * 0.08}, ${w * 0.08} ${h * 0.28}, ${w * 0.16} ${h * 0.55}
       C ${w * 0.24} ${h * 0.82}, ${w * 0.72} ${h * 0.72}, ${sx} ${sy}`,
      `M ${sx} ${sy}
       C ${w * 0.62} ${h * 0.18}, ${w * 0.2} ${h * 0.42}, ${w * 0.3} ${h * 0.66}
       C ${w * 0.42} ${h * 0.9}, ${w * 0.85} ${h * 0.6}, ${sx} ${sy}`,
    ];

    let dolatelo = 0;
    ptaci.forEach((ptak, i) => {
      ptak.style.offsetPath = `path("${drahy[i].replace(/\s+/g, " ")}")`;
      ptak.classList.add("leti");
      const let_ = ptak.animate(
        [{ offsetDistance: "0%" }, { offsetDistance: "100%" }],
        {
          duration: 1400 + i * 200,
          delay: i * 110,
          easing: "cubic-bezier(.45,.05,.35,1)",
        }
      );
      let_.onfinish = () => {
        ptak.classList.remove("leti"); // ptáček se v rohu „rozplyne"…
        dolatelo += 1;
        if (dolatelo === ptaci.length) hotovo(); // …a čárky se složí do ×
      };
    });
  };

  if (burger && menu) {
    let animujeMenu = false;

    const prepniMenu = (otevrit) => {
      if (animujeMenu) return;
      menu.classList.toggle("open", otevrit);
      burger.setAttribute("aria-expanded", String(otevrit));
      burger.setAttribute("aria-label", otevrit ? "Zavřít menu" : "Otevřít menu");
      document.body.classList.toggle("menu-otevrene", otevrit);
      document.body.style.overflow = otevrit ? "hidden" : ""; // zámek scrollu

      if (otevrit && umimLetet()) {
        animujeMenu = true;
        burger.classList.add("bez-car"); // čárky zmizí — staly se ptáčky
        letVlastovek(() => {
          burger.classList.remove("bez-car");
          burger.classList.add("open"); // pomalé složení do křížku
          animujeMenu = false;
        });
      } else {
        burger.classList.toggle("open", otevrit);
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
