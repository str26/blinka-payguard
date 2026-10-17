import Link from "next/link";
const steps = [
  ["01", "Recibir", "Facturas ficticias en PDF e imagen."],
  ["02", "Evaluar", "Interpretación con IA y validación de políticas."],
  ["03", "Supervisar", "Excepciones, aprobación humana y trazabilidad."],
];
export default function Home() {
  return <main>
    <header><a className="brand" href="/">PayGuard<span>BLINKA CHALLENGE</span></a><span className="badge">Prototipo · Sin dinero real</span></header>
    <section className="hero">
      <p className="eyebrow">HACKATHON 30X · OCTUBRE 2026</p>
      <h1>Cada factura.<br/><span>Una decisión explicable.</span></h1>
      <p className="intro">Asistencia para revisar cuentas por pagar, aplicar las reglas de la empresa y mantener el control humano sobre las excepciones.</p>
      <p><Link href="/login" style={{color:"#b8edb2",fontWeight:700}}>Iniciar sesión →</Link></p>
      <aside><strong>Base del proyecto desplegada</strong><p>Ya puedes iniciar sesión y consultar las wallets y políticas de tu empresa. La carga de facturas y la extracción con Gemini se incorporarán en la siguiente etapa.</p></aside>
    </section>
    <section className="steps" aria-label="Flujo previsto">{steps.map(([number,title,description])=><article key={number}><span className="number">{number}</span><h2>{title}</h2><p>{description}</p><span className="pending">Por implementar</span></article>)}</section>
    <footer>Proyecto independiente para el reto Blinka. Datos de demostración exclusivamente ficticios.</footer>
  </main>;
}
