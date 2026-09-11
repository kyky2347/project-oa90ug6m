"use client";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { ArrowUpRight, Globe2 } from "lucide-react";
import { cn } from "@/lib/utils";
export function Logo() {
  return (
    <Link href="/" className="brand" aria-label="PULSE home">
      <svg
        width="30"
        height="34"
        viewBox="0 0 30 34"
        fill="none"
        aria-hidden="true"
      >
        <path
          d="M15 2 28 9.5v15L15 32 2 24.5v-15L15 2Z"
          stroke="currentColor"
          strokeWidth="1.4"
        />
        <path
          d="m5 18 5-1 3-7 4 14 3-7h6"
          stroke="currentColor"
          strokeWidth="2"
          strokeLinejoin="round"
        />
      </svg>
      <span>
        PULSE<small>URBAN OPPORTUNITY INTELLIGENCE</small>
      </span>
    </Link>
  );
}
export function Header() {
  const path = usePathname();
  return (
    <header className="header">
      <Logo />
      <nav aria-label="Main navigation">
        <Link className={cn(path === "/explore" && "current")} href="/explore">
          Explore London
        </Link>
        <Link className={cn(path === "/compare" && "current")} href="/compare">
          Site Battle
        </Link>
        <Link
          className={cn(path === "/methodology" && "current")}
          href="/methodology"
        >
          Methodology
        </Link>
        <Link className={cn(path === "/data" && "current")} href="/data">
          Data health
          <span className="nav-dot" />
        </Link>
      </nav>
      <div className="header-right">
        <Globe2 size={14} />
        <span>London, UK</span>
        <span className="edition">V.01</span>
      </div>
      {path === "/" && (
        <Link className="header-cta" href="/explore">
          Open the map
          <ArrowUpRight size={16} />
        </Link>
      )}
    </header>
  );
}
