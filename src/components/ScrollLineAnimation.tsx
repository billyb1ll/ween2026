import { useEffect, useRef, useState } from "react";
import { Box } from "@chakra-ui/react";
import { useScroll, useMotionValueEvent, useReducedMotion } from "framer-motion";

export const ScrollLineAnimation = () => {
  const { scrollYProgress } = useScroll();
  const shouldReduceMotion = useReducedMotion() ?? false;
  const containerRef = useRef<HTMLDivElement>(null);
  const [svgContent, setSvgContent] = useState<string>("");

  useEffect(() => {
    let active = true;
    const fetchSvg = async () => {
      try {
        const response = await fetch("/flow.svg");
        if (!response.ok) throw new Error("Failed to load SVG");
        const text = await response.text();
        if (active) {
          setSvgContent(text);
        }
      } catch (error) {
        console.error("Error loading animation asset:", error);
      }
    };
    fetchSvg();
    return () => {
      active = false;
    };
  }, []);

  useMotionValueEvent(scrollYProgress, "change", (latest) => {
    if (!containerRef.current || shouldReduceMotion) return;
    const paths = containerRef.current.querySelectorAll("path");
    
    paths.forEach((path) => {
      const length = path.getTotalLength();
      path.style.strokeDasharray = `${length}`;
      path.style.strokeDashoffset = `${length * (1 - latest)}`;
    });
  });

  return (
    <Box
      position="fixed"
      right={0}
      top={0}
      bottom={0}
      zIndex={1}
      pointerEvents="none"
      display="flex"
      alignItems="center"
      justifyContent="flex-end"
      width={{ base: "60px", md: "150px" }}
      opacity={{ base: 0.25, md: 1 }}
      css={{
        "& svg": {
          width: "100%",
          height: "100%",
          maxHeight: "100vh",
          objectFit: "contain",
        },
        "& svg path": {
          fill: "none !important",
          stroke: "var(--c-chocolate) !important",
          strokeWidth: "2px",
          transition: "stroke-dashoffset 0.1s ease-out",
        },
      }}
    >
      <Box
        ref={containerRef}
        dangerouslySetInnerHTML={{ __html: svgContent }}
        width="100%"
        height="100%"
      />
    </Box>
  );
};
