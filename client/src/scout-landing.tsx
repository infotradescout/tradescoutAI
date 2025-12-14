import { Link } from "wouter";

const ScoutLanding = () => {
  return (
    <div style={{ padding: 40, color: "white" }}>
      <Link href="/login" className="cta">
        Create your free account
      </Link>
    </div>
  );
};

export default ScoutLanding;
