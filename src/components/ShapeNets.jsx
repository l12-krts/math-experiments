import { Suspense, useMemo, useState } from 'react';
import { Canvas } from '@react-three/fiber';
import { OrbitControls, PerspectiveCamera, Environment, ContactShadows, Text } from '@react-three/drei';
import * as THREE from 'three';

const vec = (x, y, z) => new THREE.Vector3(x, y, z);
const v2 = (x, y) => new THREE.Vector2(x, y);
const TAU = Math.PI * 2;

const dimensionValue = (dimensions, key, fallback) => {
  const value = Number(dimensions?.[key]);
  return Number.isFinite(value) ? value : fallback;
};

const triangulateFace = (face) => {
  const indices = [];
  for (let i = 1; i < face.length - 1; i++) indices.push(0, i, i + 1);
  return indices;
};

const orientFaces = (vertices, faces) => faces.map((face) => {
  const a = vertices[face[0]];
  const b = vertices[face[1]];
  const c = vertices[face[2]];
  const normal = new THREE.Vector3().subVectors(b, a).cross(new THREE.Vector3().subVectors(c, a));
  const center = face.reduce((sum, index) => sum.add(vertices[index]), new THREE.Vector3()).divideScalar(face.length);
  return normal.dot(center) < 0 ? [...face].reverse() : face;
});

const faceTo2D = (vertices, face) => {
  const points = face.map((index) => vertices[index]);
  const origin = points[0];
  const xAxis = new THREE.Vector3().subVectors(points[1], origin).normalize();
  const normal = new THREE.Vector3()
    .subVectors(points[1], origin)
    .cross(new THREE.Vector3().subVectors(points[2], origin))
    .normalize();
  const yAxis = new THREE.Vector3().crossVectors(normal, xAxis).normalize();

  return points.map((point) => {
    const relative = new THREE.Vector3().subVectors(point, origin);
    return v2(relative.dot(xAxis), relative.dot(yAxis));
  });
};

const polygonCentroid = (points) => (
  points.reduce((sum, point) => sum.add(point), new THREE.Vector2()).divideScalar(points.length)
);

const signedSide = (a, b, point) => {
  const edge = new THREE.Vector2().subVectors(b, a);
  const rel = new THREE.Vector2().subVectors(point, a);
  return edge.x * rel.y - edge.y * rel.x;
};

const transformFaceAcrossEdge = (childLocal, childEdge, parentEdge, parentCentroid) => {
  const [childAIndex, childBIndex] = childEdge;
  const [parentA, parentB] = parentEdge;
  const childA = childLocal[childAIndex];
  const childB = childLocal[childBIndex];
  const childEdgeVector = new THREE.Vector2().subVectors(childB, childA);
  const parentEdgeVector = new THREE.Vector2().subVectors(parentB, parentA);
  const angle = Math.atan2(parentEdgeVector.y, parentEdgeVector.x) - Math.atan2(childEdgeVector.y, childEdgeVector.x);
  const cos = Math.cos(angle);
  const sin = Math.sin(angle);

  const transformed = childLocal.map((point) => {
    const x = point.x - childA.x;
    const y = point.y - childA.y;
    return v2(
      parentA.x + x * cos - y * sin,
      parentA.y + x * sin + y * cos
    );
  });

  const childCentroid = polygonCentroid(transformed);
  if (Math.sign(signedSide(parentA, parentB, childCentroid)) === Math.sign(signedSide(parentA, parentB, parentCentroid))) {
    const edge = new THREE.Vector2().subVectors(parentB, parentA).normalize();
    return transformed.map((point) => {
      const relative = new THREE.Vector2().subVectors(point, parentA);
      const along = edge.dot(relative);
      const projection = parentA.clone().add(edge.clone().multiplyScalar(along));
      return projection.multiplyScalar(2).sub(point);
    });
  }

  return transformed;
};

const buildFlatNet = (vertices, faces) => {
  const localFaces = faces.map((face) => faceTo2D(vertices, face));
  const netFaces = Array(faces.length).fill(null);
  const links = [];
  const used = new Set([0]);
  const queue = [0];
  netFaces[0] = localFaces[0];

  while (queue.length) {
    const parentIndex = queue.shift();
    const parentFace = faces[parentIndex];
    const parentNet = netFaces[parentIndex];
    const parentCentroid = polygonCentroid(parentNet);

    for (let childIndex = 0; childIndex < faces.length; childIndex++) {
      if (used.has(childIndex)) continue;

      const childFace = faces[childIndex];
      const shared = parentFace.filter((index) => childFace.includes(index));
      if (shared.length !== 2) continue;

      const parentAIndex = parentFace.indexOf(shared[0]);
      const parentBIndex = parentFace.indexOf(shared[1]);
      const childAIndex = childFace.indexOf(shared[0]);
      const childBIndex = childFace.indexOf(shared[1]);
      const parentEdge = [parentNet[parentAIndex], parentNet[parentBIndex]];
      const childEdge = [childAIndex, childBIndex];

      netFaces[childIndex] = transformFaceAcrossEdge(localFaces[childIndex], childEdge, parentEdge, parentCentroid);
      links.push({
        parent: parentIndex,
        child: childIndex,
        shared,
        parentEdgeIndices: [parentAIndex, parentBIndex],
        childEdgeIndices: [childAIndex, childBIndex]
      });
      used.add(childIndex);
      queue.push(childIndex);
    }
  }

  const allPoints = netFaces.flat();
  const center = polygonCentroid(allPoints);
  return {
    faces: netFaces.map((face) => face.map((point) => point.clone().sub(center))),
    links
  };
};

const buildChainedFlatNet = (vertices, faces, path) => {
  const localFaces = faces.map((face) => faceTo2D(vertices, face));
  const netFaces = Array(faces.length).fill(null);
  const links = [];
  netFaces[path[0]] = localFaces[path[0]];

  for (let pathIndex = 1; pathIndex < path.length; pathIndex++) {
    const parentIndex = path[pathIndex - 1];
    const childIndex = path[pathIndex];
    const parentFace = faces[parentIndex];
    const childFace = faces[childIndex];
    const parentNet = netFaces[parentIndex];
    const parentCentroid = polygonCentroid(parentNet);
    const shared = parentFace.filter((index) => childFace.includes(index));
    if (shared.length !== 2) continue;

    const parentAIndex = parentFace.indexOf(shared[0]);
    const parentBIndex = parentFace.indexOf(shared[1]);
    const childAIndex = childFace.indexOf(shared[0]);
    const childBIndex = childFace.indexOf(shared[1]);
    const parentEdge = [parentNet[parentAIndex], parentNet[parentBIndex]];

    netFaces[childIndex] = transformFaceAcrossEdge(
      localFaces[childIndex],
      [childAIndex, childBIndex],
      parentEdge,
      parentCentroid
    );
    links.push({
      parent: parentIndex,
      child: childIndex,
      shared,
      parentEdgeIndices: [parentAIndex, parentBIndex],
      childEdgeIndices: [childAIndex, childBIndex]
    });
  }

  const allPoints = netFaces.flat();
  const center = polygonCentroid(allPoints);
  return {
    faces: netFaces.map((face) => face.map((point) => point.clone().sub(center))),
    links
  };
};

const buildStraightTriangularPyramidNet = (vertices, faces) => {
  const side = vertices[faces[0][0]].distanceTo(vertices[faces[0][1]]);
  const height = (Math.sqrt(3) / 2) * side;
  const bottomLeft = v2(0, 0);
  const topLeft = v2(side / 2, height);
  const bottomMid = v2(side, 0);
  const topMid = v2(side * 1.5, height);
  const bottomRight = v2(side * 2, 0);
  const topRight = v2(side * 2.5, height);
  const netFaces = [
    [topLeft, bottomMid, bottomLeft],
    [topMid, bottomMid, bottomRight],
    [topMid, topLeft, bottomMid],
    [topMid, bottomRight, topRight]
  ];
  const center = polygonCentroid(netFaces.flat());

  return {
    faces: netFaces.map((face) => face.map((point) => point.clone().sub(center))),
    links: [
      {
        parent: 0,
        child: 2,
        shared: [faces[0][0], faces[0][1]],
        parentEdgeIndices: [0, 1],
        childEdgeIndices: [1, 2]
      },
      {
        parent: 2,
        child: 1,
        shared: [faces[2][0], faces[2][2]],
        parentEdgeIndices: [0, 2],
        childEdgeIndices: [0, 1]
      },
      {
        parent: 1,
        child: 3,
        shared: [faces[1][0], faces[1][2]],
        parentEdgeIndices: [0, 2],
        childEdgeIndices: [0, 1]
      }
    ]
  };
};

const pointFromFlat = (point) => vec(point.x, 0, point.y);

const flippedFoldShapeTypes = new Set([
  'triangular prism',
  'hexagonal prism',
  'trapezoidal prism',
  'octahedron',
  'dodecahedron',
  'icosahedron'
]);

const flipFacesOverFloor = (faces) => (
  faces.map((face) => face.map((point) => vec(point.x, -point.y, point.z)))
);

const coneRimPoint = (t, radius, slant, foldAmount) => {
  const sectorSpread = (TAU * radius) / slant;
  const sectorAngle = (t - 0.5) * sectorSpread;
  const closedAngle = (t - 0.5) * TAU;
  const flatPoint = vec(
    slant * Math.sin(sectorAngle),
    0,
    radius + slant - slant * Math.cos(sectorAngle)
  );
  const closedPoint = vec(
    radius * Math.sin(closedAngle),
    0,
    radius * Math.cos(closedAngle)
  );

  return flatPoint.lerp(closedPoint, foldAmount);
};

const cylinderSidePoint = (x, radius, foldAmount) => {
  if (foldAmount < 0.001) return vec(x, 0, radius);

  const curveRadius = radius / foldAmount;
  const angle = x / curveRadius;
  return vec(
    curveRadius * Math.sin(angle),
    0,
    radius + curveRadius * (Math.cos(angle) - 1)
  );
};

const makeFixedFaceHatchGeometry = (face, spacing = 0.18) => {
  const geometry = new THREE.BufferGeometry();
  if (!face || face.length < 3) return geometry;

  const origin = face[0];
  const xAxis = new THREE.Vector3().subVectors(face[1], origin);
  if (xAxis.lengthSq() < 0.000001) return geometry;
  xAxis.normalize();

  const normal = faceNormal(face);
  const yAxis = new THREE.Vector3().crossVectors(normal, xAxis).normalize();
  const points = face.map((point) => {
    const relative = new THREE.Vector3().subVectors(point, origin);
    return v2(relative.dot(xAxis), relative.dot(yAxis));
  });
  const positions = [];
  const lift = vec(0, 0.012, 0);

  const toWorld = (point) => origin.clone()
    .add(xAxis.clone().multiplyScalar(point.x))
    .add(yAxis.clone().multiplyScalar(point.y))
    .add(lift);

  const addHatches = (direction) => {
    const dir = direction.clone().normalize();
    const lineNormal = v2(-dir.y, dir.x);
    const offsets = points.map((point) => point.dot(lineNormal));
    const minOffset = Math.min(...offsets);
    const maxOffset = Math.max(...offsets);
    const startOffset = Math.floor(minOffset / spacing) * spacing;

    for (let offset = startOffset; offset <= maxOffset + spacing; offset += spacing) {
      const hits = [];

      points.forEach((a, index) => {
        const b = points[(index + 1) % points.length];
        const da = a.dot(lineNormal) - offset;
        const db = b.dot(lineNormal) - offset;

        if (Math.abs(da) < 0.000001) hits.push(a.clone());
        if (da * db < 0) {
          hits.push(a.clone().lerp(b, da / (da - db)));
        }
      });

      const uniqueHits = hits.filter((hit, index) => (
        hits.findIndex((candidate) => candidate.distanceToSquared(hit) < 0.000001) === index
      ));
      if (uniqueHits.length < 2) continue;

      uniqueHits.sort((a, b) => a.dot(dir) - b.dot(dir));
      const from = toWorld(uniqueHits[0]);
      const to = toWorld(uniqueHits[uniqueHits.length - 1]);
      if (from.distanceToSquared(to) < 0.01) continue;
      positions.push(from.x, from.y, from.z, to.x, to.y, to.z);
    }
  };

  addHatches(v2(1, 1));
  addHatches(v2(1, -1));

  geometry.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3));
  return geometry;
};

const faceNormal = (face) => new THREE.Vector3()
  .subVectors(face[1], face[0])
  .cross(new THREE.Vector3().subVectors(face[2], face[0]))
  .normalize();

const rotationAroundLine = (a, b, angle) => {
  const axis = new THREE.Vector3().subVectors(b, a).normalize();
  const translateToOrigin = new THREE.Matrix4().makeTranslation(-a.x, -a.y, -a.z);
  const rotate = new THREE.Matrix4().makeRotationAxis(axis, angle);
  const translateBack = new THREE.Matrix4().makeTranslation(a.x, a.y, a.z);
  return translateBack.multiply(rotate).multiply(translateToOrigin);
};

const anchorFinalFacesToFloor = (vertices, faces, flatBaseFace) => {
  const baseFace = faces[0].map((index) => vertices[index]);
  const origin = baseFace[0];
  const xAxis = new THREE.Vector3().subVectors(baseFace[1], origin).normalize();
  const normal = faceNormal(baseFace);
  const zAxis = new THREE.Vector3().crossVectors(normal, xAxis).normalize();
  const flatOrigin = flatBaseFace[0];
  const localA = v2(baseFace[1].distanceTo(origin), 0);
  const baseRelB = new THREE.Vector3().subVectors(baseFace[2], origin);
  const localB = v2(baseRelB.dot(xAxis), baseRelB.dot(zAxis));
  const flatA = new THREE.Vector2().subVectors(flatBaseFace[1], flatOrigin);
  const flatB = new THREE.Vector2().subVectors(flatBaseFace[2], flatOrigin);
  const determinant = localA.x * localB.y - localA.y * localB.x;

  const mapFlatBaseOrientation = (localPoint) => {
    if (Math.abs(determinant) < 0.000001) return flatOrigin.clone().add(localPoint);

    const a = (localPoint.x * localB.y - localPoint.y * localB.x) / determinant;
    const b = (localA.x * localPoint.y - localA.y * localPoint.x) / determinant;
    return flatOrigin.clone()
      .add(flatA.clone().multiplyScalar(a))
      .add(flatB.clone().multiplyScalar(b));
  };

  return faces.map((face) => face.map((index) => {
    const rel = new THREE.Vector3().subVectors(vertices[index], origin);
    const flatPoint = mapFlatBaseOrientation(v2(rel.dot(xAxis), rel.dot(zAxis)));
    return vec(
      flatPoint.x,
      rel.dot(normal),
      flatPoint.y
    );
  }));
};

const makeHingePlan = (vertices, faces, customNet) => {
  const net = customNet ?? buildFlatNet(vertices, faces);
  const flatFaces = net.faces;
  const finalFaces = anchorFinalFacesToFloor(vertices, faces, flatFaces[0]);
  const children = Array.from({ length: faces.length }, () => []);
  net.links.forEach((link) => children[link.parent].push(link));

  const fullMatrices = Array(faces.length);
  const targetAngles = Array(faces.length).fill(0);
  fullMatrices[0] = new THREE.Matrix4();

  const queue = [0];
  while (queue.length) {
    const parent = queue.shift();
    children[parent].forEach((link) => {
      const parentMatrix = fullMatrices[parent];
      const parentFlatEdge = link.parentEdgeIndices.map((index) => pointFromFlat(flatFaces[parent][index]).applyMatrix4(parentMatrix));
      const childFinalNormal = faceNormal(finalFaces[link.child]);
      const childStartFace = flatFaces[link.child].map((point) => pointFromFlat(point).applyMatrix4(parentMatrix));
      const childStartNormal = faceNormal(childStartFace);
      const axis = new THREE.Vector3().subVectors(parentFlatEdge[1], parentFlatEdge[0]).normalize();
      const signedAngle = Math.atan2(
        axis.dot(new THREE.Vector3().crossVectors(childStartNormal, childFinalNormal)),
        THREE.MathUtils.clamp(childStartNormal.dot(childFinalNormal), -1, 1)
      );

      const candidates = [signedAngle, signedAngle + TAU, signedAngle - TAU, -signedAngle].map((candidate) => {
        const matrix = rotationAroundLine(parentFlatEdge[0], parentFlatEdge[1], candidate).multiply(parentMatrix);
        const error = flatFaces[link.child].reduce((sum, point, index) => (
          sum + pointFromFlat(point).applyMatrix4(matrix).distanceToSquared(finalFaces[link.child][index])
        ), 0);
        return { angle: candidate, matrix, error: error + Math.abs(candidate) * 0.00001 };
      });

      const best = candidates.reduce((currentBest, candidate) => (
        candidate.error < currentBest.error ? candidate : currentBest
      ), candidates[0]);
      targetAngles[link.child] = best.angle;
      fullMatrices[link.child] = best.matrix;
      queue.push(link.child);
    });
  }

  return { flatFaces, finalFaces, links: net.links, children, targetAngles };
};

const makeHingedFacePositions = (plan, foldAmount) => {
  const easedFold = foldAmount * foldAmount * (3 - 2 * foldAmount);
  const matrices = Array(plan.flatFaces.length);
  const worldFaces = Array(plan.flatFaces.length);
  const queue = [0];
  matrices[0] = new THREE.Matrix4();

  while (queue.length) {
    const parent = queue.shift();
    worldFaces[parent] = plan.flatFaces[parent].map((point) => pointFromFlat(point).applyMatrix4(matrices[parent]));

    plan.children[parent].forEach((link) => {
      const parentFlatEdge = link.parentEdgeIndices.map((index) => (
        pointFromFlat(plan.flatFaces[parent][index]).applyMatrix4(matrices[parent])
      ));
      matrices[link.child] = rotationAroundLine(
        parentFlatEdge[0],
        parentFlatEdge[1],
        plan.targetAngles[link.child] * easedFold
      ).multiply(matrices[parent]);
      queue.push(link.child);
    });
  }

  return worldFaces;
};

const makeMeshGeometry = (worldFaces) => {
  const positions = [];
  const indices = [];
  let offset = 0;

  worldFaces.forEach((face) => {
    face.forEach((vertex) => positions.push(vertex.x, vertex.y, vertex.z));
    triangulateFace(face).forEach((index) => indices.push(offset + index));
    offset += face.length;
  });

  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3));
  geometry.setIndex(indices);
  geometry.computeVertexNormals();
  return geometry;
};

const makeEdgeGeometry = (worldFaces) => {
  const positions = [];

  worldFaces.forEach((face) => {
    face.forEach((vertex, vertexIndex) => {
      const next = face[(vertexIndex + 1) % face.length];
      positions.push(vertex.x, vertex.y, vertex.z, next.x, next.y, next.z);
    });
  });

  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3));
  return geometry;
};

const regularPolygon = (sides, radius, y = 0) => (
  Array.from({ length: sides }, (_, i) => {
    const angle = Math.PI / 2 + (i * TAU) / sides;
    return vec(radius * Math.cos(angle), y, radius * Math.sin(angle));
  })
);

const makePrism = (sides, radius, height) => {
  const bottom = regularPolygon(sides, radius, -height / 2);
  const top = regularPolygon(sides, radius, height / 2);
  const vertices = [...bottom, ...top];
  const faces = [
    Array.from({ length: sides }, (_, i) => sides - 1 - i),
    Array.from({ length: sides }, (_, i) => sides + i),
    ...Array.from({ length: sides }, (_, i) => {
      const next = (i + 1) % sides;
      return [i, next, sides + next, sides + i];
    })
  ];
  return { vertices, faces: orientFaces(vertices, faces) };
};

const makePyramid = (sides, radius, height) => {
  const base = regularPolygon(sides, radius, 0);
  const apex = vec(0, height, 0);
  const vertices = [...base, apex];
  const faces = [
    Array.from({ length: sides }, (_, i) => sides - 1 - i),
    ...Array.from({ length: sides }, (_, i) => [i, (i + 1) % sides, sides])
  ];
  return { vertices, faces: orientFaces(vertices, faces) };
};

const makeTriangularPyramid = (dimensions = {}) => {
  const radius = dimensionValue(dimensions, 'size', 1.25);
  const data = makePyramid(3, radius, radius * Math.sqrt(2));
  return {
    ...data,
    net: buildStraightTriangularPyramidNet(data.vertices, data.faces)
  };
};

const makePentagonalPyramid = (dimensions = {}) => {
  const data = makePyramid(
    5,
    dimensionValue(dimensions, 'radius', 1.25),
    dimensionValue(dimensions, 'height', 1.65)
  );
  return {
    ...data,
    net: buildChainedFlatNet(data.vertices, data.faces, [0, 1, 2, 3, 4, 5])
  };
};

const makeBox = (width, height, depth) => {
  const x = width / 2;
  const y = height / 2;
  const z = depth / 2;
  const vertices = [
    vec(-x, -y, -z), vec(x, -y, -z), vec(x, -y, z), vec(-x, -y, z),
    vec(-x, y, -z), vec(x, y, -z), vec(x, y, z), vec(-x, y, z)
  ];
  const faces = [
    [0, 3, 2, 1],
    [4, 5, 6, 7],
    [0, 1, 5, 4],
    [1, 2, 6, 5],
    [2, 3, 7, 6],
    [3, 0, 4, 7]
  ];
  return { vertices, faces };
};

const makeTrapezoidalPrism = (dimensions = {}) => {
  const h = dimensionValue(dimensions, 'height', 0.8);
  const depth = dimensionValue(dimensions, 'depth', 2);
  const bottom = dimensionValue(dimensions, 'bottom', 1.7);
  const top = dimensionValue(dimensions, 'top', 0.9);
  const dx = (bottom - top) / 2;
  const front = [
    vec(-bottom / 2, -h / 2, -depth / 2),
    vec(bottom / 2, -h / 2, -depth / 2),
    vec(top / 2, h / 2, -depth / 2),
    vec(-top / 2, h / 2, -depth / 2)
  ];
  const back = front.map((point) => vec(point.x, point.y, depth / 2));
  const vertices = [...front, ...back];
  const faces = [
    [0, 3, 2, 1],
    [4, 5, 6, 7],
    [0, 1, 5, 4],
    [1, 2, 6, 5],
    [2, 3, 7, 6],
    [3, 0, 4, 7]
  ];
  return { vertices, faces: orientFaces(vertices, faces), dx };
};

const makeIcosahedron = (size = 1.55) => {
  const phi = (1 + Math.sqrt(5)) / 2;
  const vertices = [
    vec(-1, phi, 0), vec(1, phi, 0), vec(-1, -phi, 0), vec(1, -phi, 0),
    vec(0, -1, phi), vec(0, 1, phi), vec(0, -1, -phi), vec(0, 1, -phi),
    vec(phi, 0, -1), vec(phi, 0, 1), vec(-phi, 0, -1), vec(-phi, 0, 1)
  ].map((point) => point.normalize().multiplyScalar(size));
  const edgeLength = vertices[0].distanceTo(vertices[1]);
  const faces = [];

  for (let a = 0; a < vertices.length - 2; a++) {
    for (let b = a + 1; b < vertices.length - 1; b++) {
      for (let c = b + 1; c < vertices.length; c++) {
        const isFace = [vertices[a].distanceTo(vertices[b]), vertices[b].distanceTo(vertices[c]), vertices[c].distanceTo(vertices[a])]
          .every((distance) => Math.abs(distance - edgeLength) < 0.001);
        if (isFace) faces.push([a, b, c]);
      }
    }
  }

  return { vertices, faces: orientFaces(vertices, faces) };
};

const makeDodecahedron = (size = 1.45) => {
  const ico = makeIcosahedron();
  const vertices = ico.faces.map((face) => (
    face.reduce((sum, index) => sum.add(ico.vertices[index]), new THREE.Vector3()).normalize().multiplyScalar(size)
  ));
  const faces = ico.vertices.map((sourceVertex) => {
    const adjacent = ico.faces
      .map((face, index) => ({ face, index }))
      .filter(({ face }) => face.some((vertexIndex) => ico.vertices[vertexIndex].distanceTo(sourceVertex) < 0.001));
    const normal = sourceVertex.clone().normalize();
    const axisA = new THREE.Vector3(1, 0, 0).cross(normal);
    if (axisA.lengthSq() < 0.001) axisA.set(0, 0, 1).cross(normal);
    axisA.normalize();
    const axisB = new THREE.Vector3().crossVectors(normal, axisA).normalize();

    return adjacent
      .sort((a, b) => {
        const ca = vertices[a.index].clone().normalize();
        const cb = vertices[b.index].clone().normalize();
        return Math.atan2(ca.dot(axisB), ca.dot(axisA)) - Math.atan2(cb.dot(axisB), cb.dot(axisA));
      })
      .map(({ index }) => index);
  });

  return { vertices, faces: orientFaces(vertices, faces) };
};

const makeShapeData = (shapeType, dimensions = {}) => {
  switch (shapeType) {
    case 'triangular pyramid':
      return makeTriangularPyramid(dimensions);
    case 'cube':
      return makeBox(
        dimensionValue(dimensions, 'size', 1.8),
        dimensionValue(dimensions, 'size', 1.8),
        dimensionValue(dimensions, 'size', 1.8)
      );
    case 'cuboid':
      return makeBox(
        dimensionValue(dimensions, 'width', 2.2),
        dimensionValue(dimensions, 'height', 1.2),
        dimensionValue(dimensions, 'depth', 1.45)
      );
    case 'pentagonal pyramid':
      return makePentagonalPyramid(dimensions);
    case 'triangular prism':
      return makePrism(3, dimensionValue(dimensions, 'radius', 1.25), dimensionValue(dimensions, 'depth', 2.1));
    case 'hexagonal prism':
      return makePrism(6, dimensionValue(dimensions, 'radius', 1.05), dimensionValue(dimensions, 'depth', 2));
    case 'trapezoidal prism':
      return makeTrapezoidalPrism(dimensions);
    case 'octahedron': {
      const octahedronSize = dimensionValue(dimensions, 'size', 1.45);
      const vertices = [
        vec(octahedronSize, 0, 0),
        vec(-octahedronSize, 0, 0),
        vec(0, octahedronSize, 0),
        vec(0, -octahedronSize, 0),
        vec(0, 0, octahedronSize),
        vec(0, 0, -octahedronSize)
      ];
      return {
        vertices,
        faces: orientFaces(
          vertices,
          [[0, 2, 4], [4, 2, 1], [1, 2, 5], [5, 2, 0], [0, 4, 3], [4, 1, 3], [1, 5, 3], [5, 0, 3]]
        )
      };
    }
    case 'dodecahedron':
      return makeDodecahedron(dimensionValue(dimensions, 'size', 1.45));
    case 'icosahedron':
      return makeIcosahedron(dimensionValue(dimensions, 'size', 1.55));
    default:
      return makeBox(1.8, 1.8, 1.8);
  }
};

const oklchToHex = (value, fallback) => {
  const match = value.match(/oklch\(\s*([\d.]+)%?\s+([\d.]+)\s+([\d.]+)/i);
  if (!match) return value || fallback;

  const l = Number(match[1]) / 100;
  const c = Number(match[2]);
  const h = THREE.MathUtils.degToRad(Number(match[3]));
  const a = c * Math.cos(h);
  const b = c * Math.sin(h);
  const lmsL = l + 0.3963377774 * a + 0.2158037573 * b;
  const lmsM = l - 0.1055613458 * a - 0.0638541728 * b;
  const lmsS = l - 0.0894841775 * a - 1.2914855480 * b;
  const long = lmsL ** 3;
  const medium = lmsM ** 3;
  const short = lmsS ** 3;
  const linear = [
    4.0767416621 * long - 3.3077115913 * medium + 0.2309699292 * short,
    -1.2684380046 * long + 2.6097574011 * medium - 0.3413193965 * short,
    -0.0041960863 * long - 0.7034186147 * medium + 1.7076147010 * short
  ];
  const toSrgb = (channel) => {
    const clamped = THREE.MathUtils.clamp(channel, 0, 1);
    return clamped <= 0.0031308 ? 12.92 * clamped : 1.055 * (clamped ** (1 / 2.4)) - 0.055;
  };
  const hex = linear.map((channel) => Math.round(toSrgb(channel) * 255).toString(16).padStart(2, '0')).join('');
  return `#${hex}`;
};

const readThemeShapeColors = () => {
  if (typeof document === 'undefined') {
    return { accent: '#3b82f6', accentDim: '#2563eb' };
  }

  const styles = getComputedStyle(document.documentElement);
  return {
    accent: oklchToHex(styles.getPropertyValue('--accent').trim(), '#3b82f6'),
    accentDim: oklchToHex(styles.getPropertyValue('--accent-dim').trim(), '#2563eb')
  };
};

const useThemeShapeColors = () => {
  const [colors] = useState(readThemeShapeColors);

  return colors;
};

const DimensionLine = ({ from, to, label, color }) => {
  const geometry = useMemo(() => {
    const lineGeometry = new THREE.BufferGeometry();
    lineGeometry.setFromPoints([from, to]);
    return lineGeometry;
  }, [from, to]);
  const mid = useMemo(() => new THREE.Vector3().addVectors(from, to).multiplyScalar(0.5), [from, to]);

  return (
    <group>
      <line geometry={geometry}>
        <lineBasicMaterial color={color} transparent opacity={0.85} />
      </line>
      <Text position={[mid.x, mid.y + 0.08, mid.z]} fontSize={0.16} color={color} anchorX="center" anchorY="middle">
        {label}
      </Text>
    </group>
  );
};

const BoundsDimensions = ({ bounds, color }) => {
  const pad = 0.35;
  const min = bounds.min;
  const max = bounds.max;
  const width = Math.max(0.01, max.x - min.x);
  const height = Math.max(0.01, max.y - min.y);
  const depth = Math.max(0.01, max.z - min.z);

  return (
    <group>
      <DimensionLine from={vec(min.x, 0.04, max.z + pad)} to={vec(max.x, 0.04, max.z + pad)} label={`πλάτος ${width.toFixed(1)}`} color={color} />
      <DimensionLine from={vec(max.x + pad, 0.04, min.z)} to={vec(max.x + pad, 0.04, max.z)} label={`βάθος ${depth.toFixed(1)}`} color={color} />
      <DimensionLine from={vec(max.x + pad, 0, max.z + pad)} to={vec(max.x + pad, height, max.z + pad)} label={`ύψος ${height.toFixed(1)}`} color={color} />
    </group>
  );
};

const edgeKey = (a, b) => {
  const pa = `${a.x.toFixed(3)},${a.y.toFixed(3)},${a.z.toFixed(3)}`;
  const pb = `${b.x.toFixed(3)},${b.y.toFixed(3)},${b.z.toFixed(3)}`;
  return pa < pb ? `${pa}|${pb}` : `${pb}|${pa}`;
};

const FaceDimensions = ({ faces, color }) => {
  const edges = useMemo(() => {
    const seen = new Set();
    const result = [];

    faces.forEach((face) => {
      face.forEach((point, index) => {
        const next = face[(index + 1) % face.length];
        const key = edgeKey(point, next);
        const length = point.distanceTo(next);
        if (seen.has(key) || length < 0.15) return;
        seen.add(key);
        result.push({ from: point, to: next, label: length.toFixed(1) });
      });
    });

    return result.slice(0, 24);
  }, [faces]);

  return (
    <group>
      {edges.map((edge, index) => (
        <DimensionLine key={index} from={edge.from} to={edge.to} label={edge.label} color={color} />
      ))}
    </group>
  );
};

const FixedFaceHatch = ({ geometry, color }) => (
  <lineSegments geometry={geometry} renderOrder={2}>
    <lineBasicMaterial color={color} transparent opacity={0.24} depthWrite={false} />
  </lineSegments>
);

const PolyhedronNet = ({ shapeType, foldAmount, colors, showDimensions, dimensions }) => {
  const data = useMemo(() => makeShapeData(shapeType, dimensions), [shapeType, dimensions]);
  const plan = useMemo(() => makeHingePlan(data.vertices, data.faces, data.net), [data]);
  const foldedFaces = useMemo(() => makeHingedFacePositions(plan, foldAmount), [plan, foldAmount]);
  const worldFaces = useMemo(() => (
    flippedFoldShapeTypes.has(shapeType) ? flipFacesOverFloor(foldedFaces) : foldedFaces
  ), [foldedFaces, shapeType]);
  const geometry = useMemo(() => makeMeshGeometry(worldFaces), [worldFaces]);
  const edgeGeometry = useMemo(() => makeEdgeGeometry(worldFaces), [worldFaces]);
  const fixedFaceHatchGeometry = useMemo(() => makeFixedFaceHatchGeometry(worldFaces[0]), [worldFaces]);

  return (
    <group>
      <mesh geometry={geometry} castShadow receiveShadow>
        <meshStandardMaterial color={colors.accent} side={THREE.DoubleSide} transparent opacity={0.88} metalness={0.02} roughness={0.45} />
      </mesh>
      <FixedFaceHatch geometry={fixedFaceHatchGeometry} color={colors.accentDim} />
      <lineSegments geometry={edgeGeometry}>
        <lineBasicMaterial color={colors.accentDim} transparent opacity={0.95} />
      </lineSegments>
      {showDimensions && <FaceDimensions faces={worldFaces} color={colors.accentDim} />}
    </group>
  );
};

const CylinderNet = ({ foldAmount, colors, showDimensions, dimensions }) => {
  const radius = dimensionValue(dimensions, 'radius', 1);
  const height = dimensionValue(dimensions, 'height', 2.2);
  const width = TAU * radius;
  const segments = 96;
  const clampedFold = THREE.MathUtils.clamp(foldAmount, 0, 1);
  const heightFoldAngle = clampedFold * Math.PI / 2;
  const heightOffsetY = height * Math.sin(heightFoldAngle);
  const heightOffsetZ = height * Math.cos(heightFoldAngle);

  const sideGeometry = useMemo(() => {
    const positions = [];
    const indices = [];

    for (let i = 0; i <= segments; i++) {
      const t = i / segments;
      const x = (t - 0.5) * width;
      
      for (let j = 0; j <= 1; j++) {
        const h = j * height;
        const sidePoint = cylinderSidePoint(x, radius, clampedFold);
        const px = sidePoint.x;
        const heightRatio = h / height;
        const py = heightOffsetY * heightRatio;
        const pz = sidePoint.z + heightOffsetZ * heightRatio;
        
        positions.push(px, py, pz);
      }
    }

    for (let i = 0; i < segments; i++) {
      indices.push(i * 2, i * 2 + 1, (i + 1) * 2, i * 2 + 1, (i + 1) * 2 + 1, (i + 1) * 2);
    }

    const geometry = new THREE.BufferGeometry();
    geometry.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3));
    geometry.setIndex(indices);
    geometry.computeVertexNormals();
    return geometry;
  }, [clampedFold, height, heightOffsetY, heightOffsetZ, width, radius]);

  const capGeometry = useMemo(() => {
    const geometry = new THREE.CircleGeometry(radius, 64);
    geometry.rotateX(Math.PI / 2);
    return geometry;
  }, []);
  const fixedFaceHatchGeometry = useMemo(() => (
    makeFixedFaceHatchGeometry(regularPolygon(64, radius, 0), 0.16)
  ), [radius]);

  // Top hinge point (x=0, h=height)
  const phY = heightOffsetY;
  const phZ = radius + heightOffsetZ;

  return (
    <group>
      <mesh geometry={sideGeometry} castShadow receiveShadow>
        <meshStandardMaterial color={colors.accent} side={THREE.DoubleSide} transparent opacity={0.88} roughness={0.45} />
      </mesh>
      {/* Static Bottom Cap */}
      <mesh
        geometry={capGeometry}
        position={[0, 0.004, 0]}
        castShadow
        receiveShadow
      >
        <meshStandardMaterial color={colors.accent} side={THREE.DoubleSide} transparent opacity={0.88} roughness={0.45} />
      </mesh>
      <FixedFaceHatch geometry={fixedFaceHatchGeometry} color={colors.accentDim} />
      {/* Hinged Top Cap */}
      <group position={[0, phY, phZ]} rotation={[-clampedFold * Math.PI, 0, 0]}>
        <mesh
          geometry={capGeometry}
          position={[0, 0, radius]}
          castShadow
          receiveShadow
        >
          <meshStandardMaterial color={colors.accent} side={THREE.DoubleSide} transparent opacity={0.88} roughness={0.45} />
        </mesh>
      </group>
      {showDimensions && (
        <BoundsDimensions bounds={new THREE.Box3(vec(-radius, 0, -radius), vec(radius, height, radius))} color={colors.accentDim} />
      )}
    </group>
  );
};

const ConeNet = ({ foldAmount, colors, showDimensions, dimensions }) => {
  const radius = dimensionValue(dimensions, 'radius', 1);
  const height = dimensionValue(dimensions, 'height', 2.2);
  const slant = Math.sqrt(radius * radius + height * height);
  const segments = 96;
  const clampedFold = THREE.MathUtils.clamp(foldAmount, 0, 1);

  // Move the apex on the hinge arc, while the rim morphs from the flat sector
  // into the base circle. This avoids the zero-radius midpoint singularity.
  const gammaMax = Math.atan2(height, -radius);
  const currGamma = gammaMax * clampedFold;
  const apexY = slant * Math.sin(currGamma);
  const apexZ = radius + slant * Math.cos(currGamma);

  const sideGeometry = useMemo(() => {
    const positions = [0, apexY, apexZ];
    const indices = [];

    for (let i = 0; i <= segments; i++) {
      const point = coneRimPoint(i / segments, radius, slant, clampedFold);
      positions.push(point.x, point.y, point.z);
    }

    for (let i = 1; i <= segments; i++) indices.push(0, i, i + 1);

    const geometry = new THREE.BufferGeometry();
    geometry.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3));
    geometry.setIndex(indices);
    geometry.computeVertexNormals();
    return geometry;
  }, [apexY, apexZ, clampedFold, radius, slant]);

  const sideEdgeGeometry = useMemo(() => {
    const apex = vec(0, apexY, apexZ);
    const points = [];
    const edgePoint = (t) => coneRimPoint(t, radius, slant, clampedFold);

    const first = edgePoint(0);
    const last = edgePoint(1);
    points.push(apex, first);
    for (let i = 0; i < segments; i++) {
      points.push(edgePoint(i / segments), edgePoint((i + 1) / segments));
    }
    points.push(last, apex);

    const geometry = new THREE.BufferGeometry();
    geometry.setFromPoints(points);
    return geometry;
  }, [apexY, apexZ, clampedFold, radius, slant]);

  const capGeometry = useMemo(() => {
    const geometry = new THREE.CircleGeometry(radius, 64);
    geometry.rotateX(Math.PI / 2);
    return geometry;
  }, []);
  const fixedFaceHatchGeometry = useMemo(() => (
    makeFixedFaceHatchGeometry(regularPolygon(64, radius, 0), 0.16)
  ), [radius]);

  return (
    <group>
      <mesh geometry={sideGeometry} castShadow receiveShadow>
        <meshStandardMaterial color={colors.accent} side={THREE.DoubleSide} transparent opacity={0.88} roughness={0.45} />
      </mesh>
      <lineSegments geometry={sideEdgeGeometry}>
        <lineBasicMaterial color={colors.accentDim} transparent opacity={0.95} />
      </lineSegments>
      <mesh
        geometry={capGeometry}
        position={[0, 0.004, 0]}
        castShadow
        receiveShadow
      >
        <meshStandardMaterial color={colors.accent} side={THREE.DoubleSide} transparent opacity={0.88} roughness={0.45} />
      </mesh>
      <FixedFaceHatch geometry={fixedFaceHatchGeometry} color={colors.accentDim} />
      {showDimensions && (
        <BoundsDimensions bounds={new THREE.Box3(vec(-radius, 0, -radius), vec(radius, height, radius))} color={colors.accentDim} />
      )}
    </group>
  );
};

const ShapeRenderer = ({ shapeType, foldAmount, colors, showDimensions, dimensions }) => {
  if (shapeType === 'cylinder') return <CylinderNet foldAmount={foldAmount} colors={colors} showDimensions={showDimensions} dimensions={dimensions} />;
  if (shapeType === 'cone') return <ConeNet foldAmount={foldAmount} colors={colors} showDimensions={showDimensions} dimensions={dimensions} />;
  return <PolyhedronNet shapeType={shapeType} foldAmount={foldAmount} colors={colors} showDimensions={showDimensions} dimensions={dimensions} />;
};

const ShapeNets = ({ shapeType, foldAmount, showDimensions, dimensions }) => {
  const colors = useThemeShapeColors();

  return (
    <div className="w-full h-full bg-background rounded-xl overflow-hidden relative absolute inset-0">
      <Canvas shadows gl={{ antialias: true }} camera={{ position: [5, 4, 6], fov: 40 }}>
        <Suspense fallback={null}>
          <PerspectiveCamera makeDefault position={[5, 4, 6]} fov={40} />
          <OrbitControls enableDamping minDistance={2.5} maxDistance={14} />
          <ambientLight intensity={0.85} />
          <directionalLight position={[5, 8, 5]} intensity={2.2} castShadow />
          <spotLight position={[-8, 8, 8]} angle={0.25} penumbra={1} intensity={1.2} castShadow />
          <Environment preset="city" />

          <group position={[0, -1.05, 0]} rotation={[0, -0.35, 0]}>
            <ShapeRenderer shapeType={shapeType} foldAmount={foldAmount} colors={colors} showDimensions={showDimensions} dimensions={dimensions} />
          </group>

          <ContactShadows position={[0, -1.08, 0]} opacity={0.35} scale={12} blur={2.4} far={4} />
        </Suspense>
      </Canvas>
    </div>
  );
};

export default ShapeNets;
