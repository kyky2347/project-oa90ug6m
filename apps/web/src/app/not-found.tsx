import Link from "next/link";
import { Button } from "@/components/ui/button";
export default function NotFound() {
  return (
    <main className="content-page">
      <div className="page-heading">
        <div>
          <div className="eyebrow">OUTSIDE THE MAP</div>
          <h1>
            This page is
            <br />
            off our grid.
          </h1>
          <p>Return to the active London model to continue exploring.</p>
        </div>
      </div>
      <Button asChild>
        <Link href="/explore">Explore London</Link>
      </Button>
    </main>
  );
}
