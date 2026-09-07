const VISUALS = [
  {
    name: "2026 Topps Chrome Baseball Hobby Box",
    meta: "Sports · Hobby Box · Released",
    source: "Steel City Collectibles",
    image: "https://www.steelcitycollectibles.com/storage/img/uploads/products/large/Image-Mockups-00518513700.jpeg",
  },
  {
    name: "2026 Bowman Chrome Baseball Hobby Box",
    meta: "Sports · Hobby Box · Upcoming",
    source: "DA Card World",
    image: "https://assets.dacw.co/itemimages/26-bowmanchrome-bb-hobby-box.jpg",
  },
  {
    name: "Pokémon TCG: 30th Celebration Booster Bundle",
    meta: "Pokémon · Booster Bundle · Upcoming",
    source: "OBSIDIA TCG",
    image: "https://obsidia-tcg.store/cdn/shop/files/30thCelebrationBoosterBundle_d51b1031-9640-491f-81e6-2effa853ff87.webp?v=1782916736",
  },
];

export default function SealedVisualShelf() {
  return (
    <section className="sealed-visual-shelf">
      <div className="sealed-visual-inner">
        <div className="sealed-visual-head">
          <div><span>PRODUCT ARTWORK</span><h2>Know the wax at a glance.</h2><p>Starter product imagery from current retail/hobby listings. Live discovery now captures and saves imagery for confirmed SKUs automatically.</p></div>
        </div>
        <div className="sealed-visual-grid">
          {VISUALS.map((item) => (
            <article key={item.name}>
              <div className="sealed-visual-image"><img src={item.image} alt={item.name} /></div>
              <span>{item.meta}</span><h3>{item.name}</h3><small>Image source: {item.source}</small>
            </article>
          ))}
        </div>
      </div>
      <style jsx>{`
        .sealed-visual-shelf{background:#04101a;color:#dceef4;border-bottom:1px solid rgba(90,190,220,.12);font-family:Arial,sans-serif}.sealed-visual-inner{max-width:1360px;margin:0 auto;padding:18px 24px}.sealed-visual-head span{font-size:9px;color:#70dcf5;font-weight:900;letter-spacing:.13em}.sealed-visual-head h2{font-size:20px;margin:5px 0}.sealed-visual-head p{margin:0;color:#718f9c;font-size:10px}.sealed-visual-grid{display:grid;grid-template-columns:repeat(3,1fr);gap:10px;margin-top:13px}.sealed-visual-grid article{background:#071b26;border:1px solid rgba(85,185,220,.12);border-radius:10px;padding:10px}.sealed-visual-image{height:185px;background:#fff;border-radius:7px;display:flex;align-items:center;justify-content:center;overflow:hidden}.sealed-visual-image img{max-width:100%;max-height:100%;object-fit:contain}.sealed-visual-grid span{display:block;margin-top:9px;color:#66cae4;font-size:8px;text-transform:uppercase}.sealed-visual-grid h3{font-size:13px;margin:4px 0}.sealed-visual-grid small{color:#66818d;font-size:8px}@media(max-width:720px){.sealed-visual-inner{padding:15px 14px}.sealed-visual-grid{grid-template-columns:1fr}.sealed-visual-image{height:220px}}
      `}</style>
    </section>
  );
}
