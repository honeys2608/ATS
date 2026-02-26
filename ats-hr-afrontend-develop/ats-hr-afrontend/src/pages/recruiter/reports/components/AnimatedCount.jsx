import React from "react";

export default function AnimatedCount({ value }) {
  const [display, setDisplay] = React.useState(0);
  React.useEffect(() => {
    let start = 0;
    const end = parseInt(value);
    if (start === end) return;
    let increment = end / 30;
    let current = start;
    const timer = setInterval(() => {
      current += increment;
      if (current >= end) {
        setDisplay(end);
        clearInterval(timer);
      } else {
        setDisplay(Math.floor(current));
      }
    }, 20);
    return () => clearInterval(timer);
  }, [value]);
  return <span>{display}</span>;
}
