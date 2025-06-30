import Link from "next/link";
import styles from "./Footer.module.css";
import Image from "next/image";

export default function Footer() {
  const year = new Date().getFullYear();

  return (
    <footer className={styles.footer}>
      <div className={styles.content}>
        <p>Copyright &copy; {year} NFTWAB. All rights reserved!</p>
      </div>
    </footer>
  );
}
