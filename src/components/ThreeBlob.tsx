import { Canvas, useFrame } from "@react-three/fiber";
import { useRef, useEffect, useState, useCallback } from "react";
import * as THREE from "three";
import { Box } from "@chakra-ui/react";

// Custom shaders for morphing fluid blob
const vertexShader = `
uniform float uTime;
uniform float uScroll;
uniform vec2 u_pointer;
uniform float u_mouseIntensity;
varying vec3 vNormal;
varying vec3 vPosition;

// Classic 3D Noise by Ashima Arts
vec4 permute(vec4 x){return mod(((x*34.0)+1.0)*x, 289.0);}
vec4 taylorInvSqrt(vec4 r){return 1.79284291400159 - 0.85373472095314 * r;}
vec3 fade(vec3 t) {return t*t*t*(t*(t*6.0-15.0)+10.0);}

float cnoise(vec3 P){
  vec3 Pi0 = floor(P);
  vec3 Pi1 = Pi0 + vec3(1.0);
  Pi0 = mod(Pi0, 289.0);
  Pi1 = mod(Pi1, 289.0);
  vec3 Pf0 = fract(P);
  vec3 Pf1 = Pf0 - vec3(1.0);
  vec4 ix = vec4(Pi0.x, Pi1.x, Pi0.x, Pi1.x);
  vec4 iy = vec4(Pi0.yy, Pi1.yy);
  vec4 iz0 = Pi0.zzzz;
  vec4 iz1 = Pi1.zzzz;

  vec4 ixy = permute(permute(ix) + iy);
  vec4 ixy0 = permute(ixy + iz0);
  vec4 ixy1 = permute(ixy + iz1);

  vec4 gx0 = ixy0 / 7.0;
  vec4 gy0 = fract(floor(gx0) / 7.0) - 0.5;
  gx0 = fract(gx0);
  vec4 gz0 = vec4(0.5) - abs(gx0) - abs(gy0);
  vec4 sz0 = step(gz0, vec4(0.0));
  gx0 -= sz0 * (step(0.0, gx0) - 0.5);
  gy0 -= sz0 * (step(0.0, gy0) - 0.5);

  vec4 gx1 = ixy1 / 7.0;
  vec4 gy1 = fract(floor(gx1) / 7.0) - 0.5;
  gx1 = fract(gx1);
  vec4 gz1 = vec4(0.5) - abs(gx1) - abs(gy1);
  vec4 sz1 = step(gz1, vec4(0.0));
  gx1 -= sz1 * (step(0.0, gx1) - 0.5);
  gy1 -= sz1 * (step(0.0, gy1) - 0.5);

  vec3 g000 = vec3(gx0.x,gy0.x,gz0.x);
  vec3 g100 = vec3(gx0.y,gy0.y,gz0.y);
  vec3 g010 = vec3(gx0.z,gy0.z,gz0.z);
  vec3 g110 = vec3(gx0.w,gy0.w,gz0.w);
  vec3 g001 = vec3(gx1.x,gy1.x,gz1.x);
  vec3 g101 = vec3(gx1.y,gy1.y,gz1.y);
  vec3 g011 = vec3(gx1.z,gy1.z,gz1.z);
  vec3 g111 = vec3(gx1.w,gy1.w,gz1.w);

  vec4 norm0 = taylorInvSqrt(vec4(dot(g000, g000), dot(g100, g100), dot(g010, g010), dot(g110, g110)));
  g000 *= norm0.x;
  g100 *= norm0.y;
  g010 *= norm0.z;
  g110 *= norm0.w;
  vec4 norm1 = taylorInvSqrt(vec4(dot(g001, g001), dot(g101, g101), dot(g011, g011), dot(g111, g111)));
  g001 *= norm1.x;
  g101 *= norm1.y;
  g011 *= norm1.z;
  g111 *= norm1.w;

  float n000 = dot(g000, Pf0);
  float n100 = dot(g100, vec3(Pf1.x, Pf0.yz));
  float n010 = dot(g010, vec3(Pf0.x, Pf1.y, Pf0.z));
  float n110 = dot(g110, vec3(Pf1.xy, Pf0.z));
  float n001 = dot(g001, vec3(Pf0.xy, Pf1.z));
  float n101 = dot(g101, vec3(Pf1.x, Pf0.y, Pf1.z));
  float n011 = dot(g011, vec3(Pf0.x, Pf1.yz));
  float n111 = dot(g111, Pf1);

  vec3 fade_xyz = fade(Pf0);
  vec4 n_z = mix(vec4(n000, n100, n010, n110), vec4(n001, n101, n011, n111), fade_xyz.z);
  vec2 n_yz = mix(n_z.xy, n_z.zw, fade_xyz.y);
  float n_xyz = mix(n_yz.x, n_yz.y, fade_xyz.x);
  return 2.2 * n_xyz;
}

void main() {
  vNormal = normal;
  vPosition = position;
  
  // Base morphing noise
  float baseNoise = cnoise(position * 1.5 + vec3(uTime * 0.4) + vec3(uScroll * 2.0));
  float baseDeform = baseNoise * 0.25;

  // Project pointer position onto 3D sphere direction vector
  vec3 pointerDir = normalize(vec3(u_pointer, 1.0));
  
  // Distance from vertex normal to projected pointer direction
  float d = distance(normalize(position), pointerDir);
  
  // Attenuated influence (highest at cursor, fading out across the surface)
  float influence = smoothstep(1.5, 0.0, d);
  
  // Low-frequency bulge + medium-frequency wave ripples
  float bulge = influence * 0.18;
  float ripples = sin(d * 12.0 - uTime * 6.0) * 0.06 * influence;
  float pointerDeform = (bulge + ripples) * u_mouseIntensity;
  
  vec3 newPosition = position + normal * (baseDeform + pointerDeform);
  
  gl_Position = projectionMatrix * modelViewMatrix * vec4(newPosition, 1.0);
}
`;

const fragmentShader = `
uniform vec3 uColor1; // Deep Chocolate Fondant: #4A2B17
uniform vec3 uColor2; // Glowing Blue Lagoon: #C5E0E6
varying vec3 vNormal;
varying vec3 vPosition;

void main() {
  // Compute lighting
  vec3 lightDirection = normalize(vec3(5.0, 5.0, 5.0));
  float diffuse = max(dot(normalize(vNormal), lightDirection), 0.0);
  
  // Blend colors based on geometry height and lighting normal
  float mixFactor = (normalize(vNormal).y + 1.0) * 0.5;
  vec3 baseColor = mix(uColor1, uColor2, mixFactor);
  
  // Subtle glowing rim light
  float rim = 1.0 - max(dot(normalize(vNormal), vec3(0.0, 0.0, 1.0)), 0.0);
  rim = pow(rim, 3.0);
  
  // Soft atmospheric rim color
  vec3 rimColor = vec3(0.77, 0.88, 0.90) * rim * 0.45;
  
  vec3 finalColor = baseColor * (diffuse * 0.7 + 0.35) + rimColor;
  
  gl_FragColor = vec4(finalColor, 0.92);
}
`;

const initialUniforms = {
  uTime: { value: 0 },
  uScroll: { value: 0 },
  uColor1: { value: new THREE.Color("#4A2B17") },
  uColor2: { value: new THREE.Color("#C5E0E6") },
  u_pointer: { value: new THREE.Vector2(0, 0) },
  u_mouseIntensity: { value: 0.0 },
};

interface BlobMeshProps {
  scrollY: number;
}

function BlobMesh({ scrollY }: BlobMeshProps) {
  const meshRef = useRef<THREE.Mesh>(null);
  const materialRef = useRef<THREE.ShaderMaterial>(null);
  const scrollRef = useRef(0);

  // Refs for tracking pointer coordinates smoothly
  const pointerXRef = useRef(0);
  const pointerYRef = useRef(0);
  const pointerInsideRef = useRef(false);
  const lastMoveTimeRef = useRef(0);
  const currentIntensityRef = useRef(0);

  useEffect(() => {
    const handlePointerMove = () => {
      pointerInsideRef.current = true;
      lastMoveTimeRef.current = performance.now();
    };

    const handlePointerLeave = () => {
      pointerInsideRef.current = false;
    };

    const handlePointerEnter = () => {
      pointerInsideRef.current = true;
      lastMoveTimeRef.current = performance.now();
    };

    window.addEventListener("pointermove", handlePointerMove, {
      passive: true,
    });
    document.addEventListener("mouseleave", handlePointerLeave, {
      passive: true,
    });
    document.addEventListener("mouseenter", handlePointerEnter, {
      passive: true,
    });

    return () => {
      window.removeEventListener("pointermove", handlePointerMove);
      document.removeEventListener("mouseleave", handlePointerLeave);
      document.removeEventListener("mouseenter", handlePointerEnter);
    };
  }, []);

  useFrame((state) => {
    const totalHeight =
      document.documentElement.scrollHeight - window.innerHeight || 1;
    const targetScroll = scrollY / totalHeight;

    // Smooth scroll interpolation (lerp)
    scrollRef.current = THREE.MathUtils.lerp(
      scrollRef.current,
      targetScroll,
      0.06,
    );

    // Smooth pointer coordinate tracking (lerp factor 0.03 for luxurious, fluid feel)
    pointerXRef.current = THREE.MathUtils.lerp(
      pointerXRef.current,
      state.pointer.x,
      0.03,
    );
    pointerYRef.current = THREE.MathUtils.lerp(
      pointerYRef.current,
      state.pointer.y,
      0.03,
    );

    // Dynamic mouse intensity tracking (lerp factor 0.05)
    // Awakening on movement, decaying when stationary (> 1.0s) or off-canvas
    const now = performance.now();
    const timeSinceLastMove = now - lastMoveTimeRef.current;
    const targetIntensity =
      pointerInsideRef.current && timeSinceLastMove < 1000 ? 1.0 : 0.0;
    currentIntensityRef.current = THREE.MathUtils.lerp(
      currentIntensityRef.current,
      targetIntensity,
      0.05,
    );

    // Update time, scroll, pointer and mouseIntensity uniforms directly on the instantiated material object
    if (materialRef.current) {
      materialRef.current.uniforms.uTime.value = state.clock.elapsedTime;
      materialRef.current.uniforms.uScroll.value = scrollRef.current;
      materialRef.current.uniforms.u_pointer.value.set(
        pointerXRef.current,
        pointerYRef.current,
      );
      materialRef.current.uniforms.u_mouseIntensity.value =
        currentIntensityRef.current;
    }

    // Dynamic rotation, scale, and translation shifts
    if (meshRef.current) {
      // Y-axis: base rotation + scroll-driven rotation + pointer X offset (clamped to max 0.25 rad)
      meshRef.current.rotation.y =
        state.clock.elapsedTime * 0.15 +
        scrollRef.current * Math.PI * 1.5 +
        pointerXRef.current * 0.25;

      // X-axis: base rotation - pointer Y offset (clamped to max 0.25 rad)
      meshRef.current.rotation.x =
        state.clock.elapsedTime * 0.08 - pointerYRef.current * 0.25;

      // Scaling down gracefully as user scrolls
      const scale = 1.85 - scrollRef.current * 0.5;
      meshRef.current.scale.setScalar(scale);

      // Vertical position shifts to follow typography flow
      meshRef.current.position.y = -scrollRef.current * 2.8;
    }
  });

  return (
    <mesh ref={meshRef} position={[0.5, 0.2, 0]}>
      <sphereGeometry args={[1, 128, 128]} />
      <shaderMaterial
        ref={materialRef}
        vertexShader={vertexShader}
        fragmentShader={fragmentShader}
        uniforms={initialUniforms}
        transparent
      />
    </mesh>
  );
}

export function ThreeBlob() {
  const [scrollY, setScrollY] = useState(0);

  const handleScroll = useCallback(() => {
    setScrollY(window.scrollY);
  }, []);

  useEffect(() => {
    window.addEventListener("scroll", handleScroll, { passive: true });
    return () => window.removeEventListener("scroll", handleScroll);
  }, [handleScroll]);

  return (
    <Box position="absolute" inset={0} pointerEvents="none" zIndex={1} h="100%">
      <Canvas
        camera={{ position: [0, 0, 3.5], fov: 45 }}
        gl={{ antialias: true, alpha: true, powerPreference: "high-performance" }}
        dpr={[1, 1.5]} // Performance optimization: cap pixel ratio
        style={{
          position: "sticky",
          top: 0,
          width: "100%",
          height: "100vh",
          pointerEvents: "none",
        }}
      >
        <ambientLight intensity={0.5} />
        <directionalLight position={[10, 10, 5]} intensity={1} />
        <BlobMesh scrollY={scrollY} />
      </Canvas>
    </Box>
  );
}
