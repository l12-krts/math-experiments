import React, { useMemo, Suspense } from 'react';
import { Canvas } from '@react-three/fiber';
import { OrbitControls, PerspectiveCamera, Environment, ContactShadows, Float } from '@react-three/drei';
import * as THREE from 'three';

// Returns vertices of a regular polygon with n sides and side length L
// Edge 0 is at (0,0) to (L,0)
const getRegularPolygonAtEdge = (n, L) => {
  const vertices = [new THREE.Vector2(0, 0), new THREE.Vector2(L, 0)];
  const externalAngle = (2 * Math.PI) / n;

  let currentAngle = 0;
  for (let i = 2; i < n; i++) {
    currentAngle += externalAngle;
    const last = vertices[vertices.length - 1];
    vertices.push(new THREE.Vector2(
      last.x + L * Math.cos(currentAngle),
      last.y + L * Math.sin(currentAngle)
    ));
  }
  return vertices;
};

const getRect = (w, h) => [
  new THREE.Vector2(0, 0),
  new THREE.Vector2(w, 0),
  new THREE.Vector2(w, h),
  new THREE.Vector2(0, h),
];

const getTrapezoid = (b1, b2, h) => {
    const dx = (b1 - b2) / 2;
    return [
        new THREE.Vector2(0, 0),
        new THREE.Vector2(b1, 0),
        new THREE.Vector2(b1 - dx, h),
        new THREE.Vector2(dx, h),
    ];
};

const tetrahedronAngle = Math.acos(1/3);
const cubeAngle = Math.PI / 2;
const octahedronAngle = Math.acos(-1/3);
const dodecahedronAngle = Math.acos(-1 / Math.sqrt(5));
const icosahedronAngle = Math.acos(-Math.sqrt(5) / 3);

const PolyFace = ({ vertices, children, foldAmount, color = "#3b82f6" }) => {
  const shape = useMemo(() => {
    const s = new THREE.Shape();
    s.moveTo(vertices[0].x, vertices[0].y);
    for (let i = 1; i < vertices.length; i++) s.lineTo(vertices[i].x, vertices[i].y);
    s.closePath();
    return s;
  }, [vertices]);

  const geometry = useMemo(() => new THREE.ShapeGeometry(shape), [shape]);

  return (
    <group>
      <mesh geometry={geometry}>
        <meshStandardMaterial color={color} side={THREE.DoubleSide} transparent opacity={0.85} metalness={0.1} roughness={0.2} />
      </mesh>
      <lineSegments>
        <edgesGeometry args={[geometry]} />
        <lineBasicMaterial color="white" transparent opacity={0.5} />
      </lineSegments>
      {children && children.map((child, i) => {
        const vA = vertices[child.parentEdgeIndex];
        const vB = vertices[(child.parentEdgeIndex + 1) % vertices.length];
        const edge = new THREE.Vector2().subVectors(vB, vA);
        const angle = Math.atan2(edge.y, edge.x);

        return (
          <group key={i} position={[vA.x, vA.y, 0]} rotation={[0, 0, angle]}>
            <group rotation={[child.targetAngle * foldAmount, 0, 0]}>
              <PolyFace vertices={child.vertices} children={child.children} foldAmount={foldAmount} color={color} />
            </group>
          </group>
        );
      })}
    </group>
  );
};

const CylinderNet = ({ foldAmount, color = "#3b82f6" }) => {
  const radius = 1;
  const height = 2.5;
  const segments = 64;
  const width = 2 * Math.PI * radius;

  const foldedVertices = useMemo(() => {
    const v = [];
    for (let i = 0; i <= segments; i++) {
      const x = (i / segments) * width;
      for (let j = 0; j <= 1; j++) {
        const y = j * height;
        if (foldAmount < 0.001) {
          v.push(new THREE.Vector3(x, y, 0));
        } else {
          const currentTotalAngle = 2 * Math.PI * foldAmount;
          const currentAngle = currentTotalAngle * (i / segments);
          const r_curv = width / currentTotalAngle;

          v.push(new THREE.Vector3(
            r_curv * Math.sin(currentAngle),
            y,
            r_curv * (1 - Math.cos(currentAngle))
          ));
        }
      }
    }
    return v;
  }, [foldAmount, width, height, radius]);

  const indices = useMemo(() => {
    const idx = [];
    for (let i = 0; i < segments; i++) {
      idx.push(i * 2, i * 2 + 1, (i + 1) * 2);
      idx.push(i * 2 + 1, (i + 1) * 2 + 1, (i + 1) * 2);
    }
    return idx;
  }, []);

  const geo = useMemo(() => {
    const g = new THREE.BufferGeometry();
    g.setFromPoints(foldedVertices);
    g.setIndex(indices);
    g.computeVertexNormals();
    return g;
  }, [foldedVertices, indices]);

  return (
    <group position={[-width/2 * (1 - foldAmount), -height/2, 0]}>
      <mesh geometry={geo}>
        <meshStandardMaterial color={color} side={THREE.DoubleSide} transparent opacity={0.85} metalness={0.1} roughness={0.2} />
      </mesh>
      {/* Top Cap */}
      <group position={[0, height, 0]} rotation={[-Math.PI / 2, 0, 0]}>
        <group rotation={[foldAmount * Math.PI / 2, 0, 0]} position={[0, radius, 0]}>
          <mesh rotation={[Math.PI / 2, 0, 0]}>
            <circleGeometry args={[radius, 32]} />
            <meshStandardMaterial color={color} side={THREE.DoubleSide} transparent opacity={0.85} />
          </mesh>
        </group>
      </group>
      {/* Bottom Cap */}
      <group position={[0, 0, 0]} rotation={[Math.PI / 2, 0, 0]}>
        <group rotation={[foldAmount * Math.PI / 2, 0, 0]} position={[0, -radius, 0]}>
          <mesh rotation={[-Math.PI / 2, 0, 0]}>
            <circleGeometry args={[radius, 32]} />
            <meshStandardMaterial color={color} side={THREE.DoubleSide} transparent opacity={0.85} />
          </mesh>
        </group>
      </group>
    </group>
  );
};

const ConeNet = ({ foldAmount, color = "#3b82f6" }) => {
  const radius = 1;
  const slantHeight = 2.5;
  const segments = 64;
  const sectorAngle = (2 * Math.PI * radius) / slantHeight;

  const geo = useMemo(() => {
    const g = new THREE.BufferGeometry();
    const vertices = [];
    const indices = [];

    const coneHalfAngle = Math.asin(radius / slantHeight);
    const apexIdx = segments + 1;

    for (let i = 0; i <= segments; i++) {
      const t = i / segments;
      const alpha = t * sectorAngle;

      if (foldAmount < 0.001) {
        vertices.push(slantHeight * Math.cos(alpha), slantHeight * Math.sin(alpha), 0);
      } else {
        const phi = alpha / foldAmount;
        const currentHalfAngle = coneHalfAngle * foldAmount;
        const r_base = slantHeight * Math.sin(currentHalfAngle);
        const z = slantHeight * Math.cos(currentHalfAngle);

        vertices.push(r_base * Math.cos(phi), r_base * Math.sin(phi), slantHeight - z);
      }
    }

    // Apex
    if (foldAmount < 0.001) {
        vertices.push(0, 0, 0);
    } else {
        vertices.push(0, 0, slantHeight);
    }

    for (let i = 0; i < segments; i++) {
        indices.push(apexIdx, i, i + 1);
    }

    g.setAttribute('position', new THREE.Float32BufferAttribute(vertices, 3));
    g.setIndex(indices);
    g.computeVertexNormals();
    return g;
  }, [foldAmount, sectorAngle, radius, slantHeight]);

  return (
    <group>
      <mesh geometry={geo}>
        <meshStandardMaterial color={color} side={THREE.DoubleSide} transparent opacity={0.85} metalness={0.1} roughness={0.2} />
      </mesh>
      {/* Base Circle */}
      <group position={[slantHeight, 0, 0]} rotation={[0, 0, 0]}>
         <group rotation={[0, -foldAmount * (Math.PI/2 + Math.asin(radius/slantHeight)), 0]} position={[radius, 0, 0]}>
            <mesh rotation={[0, Math.PI/2, 0]}>
               <circleGeometry args={[radius, 32]} />
               <meshStandardMaterial color={color} side={THREE.DoubleSide} transparent opacity={0.85} />
            </mesh>
         </group>
      </group>
    </group>
  );
};

const ShapeRenderer = ({ shapeType, foldAmount }) => {
  const tri = useMemo(() => getRegularPolygonAtEdge(3, 1.2), []);
  const sq = useMemo(() => getRegularPolygonAtEdge(4, 1.2), []);
  const pent = useMemo(() => getRegularPolygonAtEdge(5, 1.0), []);
  const hex = useMemo(() => getRegularPolygonAtEdge(6, 0.8), []);

  const net = useMemo(() => {
    const sideTri = (h) => [new THREE.Vector2(0,0), new THREE.Vector2(1.2, 0), new THREE.Vector2(0.6, h)];

    switch (shapeType) {
      case 'triangular pyramid':
        return {
          vertices: tri,
          children: [0, 1, 2].map(i => ({ parentEdgeIndex: i, targetAngle: tetrahedronAngle, vertices: tri, children: [] }))
        };
      case 'cube':
        return {
          vertices: sq,
          children: [
            { parentEdgeIndex: 0, targetAngle: cubeAngle, vertices: sq, children: [] },
            { parentEdgeIndex: 1, targetAngle: cubeAngle, vertices: sq, children: [] },
            { parentEdgeIndex: 2, targetAngle: cubeAngle, vertices: sq, children: [
                { parentEdgeIndex: 2, targetAngle: cubeAngle, vertices: sq, children: [
                    { parentEdgeIndex: 2, targetAngle: cubeAngle, vertices: sq, children: [] }
                ] }
            ] },
            { parentEdgeIndex: 3, targetAngle: cubeAngle, vertices: sq, children: [] },
          ]
        };
      case 'cuboid':
        const [w, d, h] = [1.8, 1.2, 0.8];
        const rW = getRect(w, h);
        const rD = getRect(d, h);
        const base = getRect(w, d);
        return {
            vertices: base,
            children: [
                { parentEdgeIndex: 0, targetAngle: cubeAngle, vertices: rW, children: [] },
                { parentEdgeIndex: 1, targetAngle: cubeAngle, vertices: rD, children: [] },
                { parentEdgeIndex: 2, targetAngle: cubeAngle, vertices: rW, children: [
                    { parentEdgeIndex: 2, targetAngle: cubeAngle, vertices: base, children: [] }
                ] },
                { parentEdgeIndex: 3, targetAngle: cubeAngle, vertices: rD, children: [] },
            ]
        };
      case 'pentagonal pyramid':
        const pTri = sideTri(1.6);
        const pAngle = Math.acos((1.0 / (2 * Math.tan(Math.PI/5))) / 1.6);
        return {
            vertices: pent,
            children: [0,1,2,3,4].map(i => ({ parentEdgeIndex: i, targetAngle: pAngle, vertices: pTri, children: [] }))
        };
      case 'triangular prism':
        const tpRect = getRect(1.2, 2);
        return {
            vertices: tri,
            children: [
                { parentEdgeIndex: 0, targetAngle: cubeAngle, vertices: tpRect, children: [] },
                { parentEdgeIndex: 1, targetAngle: cubeAngle, vertices: tpRect, children: [
                    { parentEdgeIndex: 2, targetAngle: cubeAngle, vertices: tri, children: [] }
                ] },
                { parentEdgeIndex: 2, targetAngle: cubeAngle, vertices: tpRect, children: [] },
            ]
        };
      case 'hexagonal prism':
        const hRect = getRect(0.8, 2);
        return {
            vertices: hex,
            children: [0,1,2,3,4,5].map(i => ({
                parentEdgeIndex: i,
                targetAngle: cubeAngle,
                vertices: hRect,
                children: i === 3 ? [{ parentEdgeIndex: 2, targetAngle: cubeAngle, vertices: hex, children: [] }] : []
            }))
        };
      case 'trapezoidal prism':
        const trap = getTrapezoid(1.5, 0.8, 0.8);
        const s_side = Math.sqrt(0.35**2 + 0.8**2);
        return {
            vertices: trap,
            children: [
                { parentEdgeIndex: 0, targetAngle: cubeAngle, vertices: getRect(1.5, 2), children: [] },
                { parentEdgeIndex: 1, targetAngle: cubeAngle, vertices: getRect(s_side, 2), children: [] },
                { parentEdgeIndex: 2, targetAngle: cubeAngle, vertices: getRect(0.8, 2), children: [
                    { parentEdgeIndex: 2, targetAngle: cubeAngle, vertices: trap, children: [] }
                ] },
                { parentEdgeIndex: 3, targetAngle: cubeAngle, vertices: getRect(s_side, 2), children: [] },
            ]
        };
      case 'octahedron':
        const oArm = (len) => len <= 0 ? [] : [{ parentEdgeIndex: 1, targetAngle: octahedronAngle, vertices: tri, children: oArm(len-1) }];
        return {
            vertices: tri,
            children: [
                { parentEdgeIndex: 0, targetAngle: octahedronAngle, vertices: tri, children: oArm(3) },
                { parentEdgeIndex: 2, targetAngle: octahedronAngle, vertices: tri, children: oArm(2) }
            ]
        };
      case 'dodecahedron':
        return {
            vertices: pent,
            children: [0, 1, 2, 3, 4].map(i => ({
                parentEdgeIndex: i,
                targetAngle: dodecahedronAngle,
                vertices: pent,
                children: i === 0 ? [
                    {
                        parentEdgeIndex: 2, targetAngle: dodecahedronAngle, vertices: pent,
                        children: [1, 2, 3, 4].map(j => ({
                            parentEdgeIndex: j, targetAngle: dodecahedronAngle, vertices: pent,
                            children: j === 2 ? [{ parentEdgeIndex: 2, targetAngle: dodecahedronAngle, vertices: pent, children: [] }] : []
                        }))
                    }
                ] : []
            }))
        };
      case 'icosahedron':
        const iStrip = (n) => n <= 0 ? [] : [{
            parentEdgeIndex: (n % 2 === 1) ? 2 : 1,
            targetAngle: icosahedronAngle,
            vertices: tri,
            children: iStrip(n - 1)
        }];
        return {
            vertices: tri,
            children: [
                { parentEdgeIndex: 0, targetAngle: icosahedronAngle, vertices: tri, children: iStrip(18) }
            ]
        };
      default:
        return null;
    }
  }, [shapeType, tri, sq, pent, hex]);

  if (shapeType === 'cylinder') return <CylinderNet foldAmount={foldAmount} />;
  if (shapeType === 'cone') return <ConeNet foldAmount={foldAmount} />;
  if (!net) return null;

  return (
    <group rotation={[-Math.PI / 2, 0, 0]} position={[0, 0, 0]}>
      <PolyFace vertices={net.vertices} children={net.children} foldAmount={foldAmount} color={shapeType === 'dodecahedron' ? '#f59e0b' : shapeType === 'icosahedron' ? '#8b5cf6' : '#3b82f6'} />
    </group>
  );
};

const ShapeNets = ({ shapeType, foldAmount }) => {
  return (
    <div className="w-full h-full bg-slate-900 rounded-xl overflow-hidden relative absolute inset-0">
      <Canvas shadows gl={{ antialias: true }}>
        <Suspense fallback={null}>
          <PerspectiveCamera makeDefault position={[5, 5, 5]} fov={40} />
          <OrbitControls enableDamping minDistance={2} maxDistance={15} />
          <ambientLight intensity={0.7} />
          <pointLight position={[10, 10, 10]} intensity={2} castShadow />
          <spotLight position={[-10, 10, 10]} angle={0.2} penumbra={1} intensity={1.5} castShadow />
          <Environment preset="city" />

          <Float speed={1.5} rotationIntensity={0.3} floatIntensity={0.3}>
            <group position={[0, -0.5, 0]}>
               <ShapeRenderer shapeType={shapeType} foldAmount={foldAmount} />
            </group>
          </Float>

          <ContactShadows position={[0, -2.5, 0]} opacity={0.5} scale={15} blur={2.5} far={4} />
        </Suspense>
      </Canvas>
      <div className="absolute top-6 left-6 text-white font-bold capitalize bg-black/50 px-4 py-2 rounded-xl backdrop-blur-md border border-white/10 tracking-wide pointer-events-none">
        {shapeType}
      </div>
    </div>
  );
};

export default ShapeNets;
