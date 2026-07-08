// Odpočet do svatby — doplní „za X dní · " před místo konání v prologu.
// Když JavaScript neběží, prolog zobrazí jen „Jitkovský mlýn" (nic se nerozbije).
document.addEventListener("DOMContentLoaded", () => {
  const el = document.getElementById("odpocet");
  if (!el) return;

  const svatba = new Date(2027, 3, 24); // měsíce se počítají od 0 → 3 = duben
  const dnes = new Date();
  svatba.setHours(0, 0, 0, 0);
  dnes.setHours(0, 0, 0, 0);

  const dni = Math.round((svatba - dnes) / 86400000);
  if (dni < 0) return; // po svatbě odpočet nezobrazujeme

  // České skloňování: 1 den, 2–4 dny, 5+ dní
  const tvar = dni === 1 ? "den" : dni >= 2 && dni <= 4 ? "dny" : "dní";
  el.textContent = dni === 0 ? "je to dnes! · " : `za ${dni} ${tvar} · `;
});
