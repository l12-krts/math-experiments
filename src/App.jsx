import { useEffect, useRef, useState } from 'react'
import reactLogo from './assets/react.svg'
import viteLogo from './assets/vite.svg'
import heroImg from './assets/hero.png'
import { Button, Card, Slider, Separator, SliderTrack, SliderFill, SliderThumb, SliderOutput, Label, Tabs, Tab, Input, Select, SelectTrigger, SelectValue, SelectIndicator, SelectPopover, ListBox, ListBoxItem } from '@heroui/react'
import { IoArrowForwardCircle, IoCloseCircle, IoArrowUp, IoArrowDown, IoPlayCircle, IoPauseCircle, IoEye, IoEyeOff} from "react-icons/io5";
import './App.css'
import './index.css'
import CircleAreaDemo from './components/CircleAreaDemo'
import MusicEquation from './components/MusicEquation'
import ShapeNets from './components/ShapeNets'
import { subscribe } from './util/events'

const clamp01 = (value) => Math.min(1, Math.max(0, value));
const TAU = Math.PI * 2;

const shapeDimensionDefaults = {
  "triangular pyramid": { size: 1.25 },
  cube: { size: 1.8 },
  cuboid: { width: 2.2, height: 1.2, depth: 1.45 },
  "pentagonal pyramid": { radius: 1.25, height: 1.65 },
  cylinder: { radius: 1, height: 2.2 },
  "triangular prism": { radius: 1.25, depth: 2.1 },
  "hexagonal prism": { radius: 1.05, depth: 2 },
  "trapezoidal prism": { bottom: 1.7, top: 0.9, height: 0.8, depth: 2 },
  cone: { radius: 1, height: 2.2 },
  octahedron: { size: 1.45 },
  dodecahedron: { size: 1.45 },
  icosahedron: { size: 1.55 }
};

const shapeDimensionControls = {
  "triangular pyramid": [
    { key: "size", label: "Μέγεθος", min: 0.5, max: 5, step: 0.05 }
  ],
  cube: [
    { key: "size", label: "Μέγεθος", min: 0.5, max: 5, step: 0.05 }
  ],
  cuboid: [
    { key: "width", label: "Μήκος", min: 0.5, max: 5, step: 0.05 },
    { key: "height", label: "Ύψος", min: 0.5, max: 5, step: 0.05 },
    { key: "depth", label: "Βάθος", min: 0.5, max: 5, step: 0.05 }
  ],
  "pentagonal pyramid": [
    { key: "radius", label: "Ακτίνα", min: 0.5, max: 5, step: 0.05 },
    { key: "height", label: "Ύψος", min: 0.5, max: 5, step: 0.05 }
  ],
  cylinder: [
    { key: "radius", label: "Ακτίνα", min: 0.5, max: 5, step: 0.05 },
    { key: "height", label: "Ύψος", min: 0.5, max: 5, step: 0.05 }
  ],
  "triangular prism": [
    { key: "radius", label: "Ακτίνα", min: 0.5, max: 5, step: 0.05 },
    { key: "depth", label: "Ύψος", min: 0.5, max: 5, step: 0.05 }
  ],
  "hexagonal prism": [
    { key: "radius", label: "Ακτίνα", min: 0.5, max: 5, step: 0.05 },
    { key: "depth", label: "Βάθος", min: 0.5, max: 5, step: 0.05 }
  ],
  "trapezoidal prism": [
    { key: "bottom", label: "Κάτω", min: 0.5, max: 5, step: 0.05 },
    { key: "top", label: "Πάνω", min: 0.5, max: 5, step: 0.05 },
    { key: "height", label: "Ύψος", min: 0.5, max: 5, step: 0.05 },
    { key: "depth", label: "Βάθος", min: 0.5, max: 5, step: 0.05 }
  ],
  cone: [
    { key: "radius", label: "Ακτίνα", min: 0.5, max: 5, step: 0.05 },
    { key: "height", label: "Ύψος", min: 0.5, max: 5, step: 0.05 }
  ],
  octahedron: [
    { key: "size", label: "Μέγεθος", min: 0.5, max: 5, step: 0.05 }
  ],
  dodecahedron: [
    { key: "size", label: "Μέγεθος", min: 0.5, max: 5, step: 0.05 }
  ],
  icosahedron: [
    { key: "size", label: "Μέγεθος", min: 0.5, max: 5, step: 0.05 }
  ]
};

const getShapeDimensions = (shape, shapeDimensions) => ({
  ...(shapeDimensionDefaults[shape] ?? {}),
  ...(shapeDimensions[shape] ?? {})
});

// 1. Accept the state variables and setters as props
function CurrentModalContent({
  spage, 
  radius, setRadius, 
  segments, setSegments, 
  isMoved, setIsMoved, 
  setCardVisible, equation, setEquation, playing, setPlaying,
  shape, setShape, fold, setFold, showDimensions, setShowDimensions,
  autoFold, setAutoFold, foldSpeed, setFoldSpeed,
  shapeDimensions, setShapeDimension
}) {
  const handleInputChange = (e) => {
    // Access the value from the native HTML input element
    setEquation(e.target.value);
  };
  if (spage === "react-aria-1") {
    return(
      <>
        <Slider minValue={5} maxValue={25} step={5} formatOptions={{style: "unit", unit: "centimeter"}} value={radius} onChange={(value) => {setRadius(value)}}>
          <Label>Ακτίνα</Label>
          <SliderOutput/>
          <SliderTrack>
            <SliderFill/>
            <SliderThumb/>
          </SliderTrack>
        </Slider>
        <Slider minValue={2} maxValue={102} step={5} value={segments} onChange={(value) => {setSegments(value)}}>
          <Label>Κομμάτια</Label>
          <SliderOutput/>
          <SliderTrack>
            <SliderFill/>
            <SliderThumb/>
          </SliderTrack>
        </Slider>
        <div className='flex flex-row justify-between'>
          <Button className="mu-2" onClick={() => {setIsMoved(!isMoved)}}>
            <IoArrowForwardCircle scale={34}/>
            Μετακίνηση Κομματιών
          </Button>
          <Button className="bg-transparent hover:scale-[1.3] hover:text-(--accent) transition duration-[300ms]" onClick={() => setCardVisible(false)}>
            <IoCloseCircle scale={34}/>
          </Button>
        </div>
      </>
    );
  } else if (spage === "react-aria-2") {
    return(
      <>
        <Label>Συνάρτηση</Label>
        <Input className='bg-(--default)' value={equation} onChange={handleInputChange}/>
        <div className='flex flex-row justify-between'>
          <Button onClick={() => {setPlaying(!playing)}}>
            {!playing ? (<><IoPlayCircle/>Αναπαραγωγή</>) : (<><IoPauseCircle/>Πάυση</>)}
          </Button>
          <Button className="bg-transparent hover:scale-[1.3] hover:text-(--accent) transition duration-[300ms]" onClick={() => setCardVisible(false)}>
            <IoCloseCircle scale={34}/>
          </Button>
        </div>
      </>
    );
  } else if (spage === "react-aria-3") {
    const shapes = [
      { id: "triangular pyramid", name: "Τριγωνική πυραμίδα" },
      { id: "cube", name: "Κύβος" },
      { id: "cuboid", name: "Ορθογώνιο παραλληλεπίπεδο" },
      { id: "pentagonal pyramid", name: "Πενταγωνική πυραμίδα" },
      { id: "cylinder", name: "Κύλινδρος" },
      { id: "triangular prism", name: "Τριγωνικό πρίσμα" },
      { id: "hexagonal prism", name: "Εξαγωνικό πρίσμα" },
      { id: "trapezoidal prism", name: "Τραπεζοειδές πρίσμα" },
      { id: "cone", name: "Κώνος" },
      { id: "octahedron", name: "Οκτάεδρο" },
      { id: "dodecahedron", name: "Δωδεκάεδρο" },
      { id: "icosahedron", name: "Εικοσάεδρο" }
    ];
    const dimensionControls = shapeDimensionControls[shape] ?? [];
    const currentDimensions = getShapeDimensions(shape, shapeDimensions);
    return (
      <div className='min-w-2xl gap-4 flex-col'>
        <Select
          selectedKey={shape}
          onSelectionChange={(key) => setShape(key.toString())}
          className="max-w-70 border-border"
        >
          <Label className='mb-1'>Σχήμα</Label>
          <SelectTrigger className='w-full border-border'>
            <SelectValue>{shapes.find((s) => s.id === shape)?.name}</SelectValue>
            <SelectIndicator />
          </SelectTrigger>
          <SelectPopover>
            <ListBox className='p-4 bg-default gap-2 rounded-(2px) border-none'>
              {shapes.map((s) => (
                <ListBoxItem key={s.id} id={s.id} textValue={s.name} className='p-3 hover:bg-border rounded-xl cursor-pointer text-accent-foreground outline-none data-[selected]:bg-segment'>
                  {s.name}
                </ListBoxItem>
              ))}
            </ListBox>
          </SelectPopover>
        </Select>
        <Separator className="my-4 max-w-70" />
        <Slider
          minValue={0}
          maxValue={1}
          step={0.01}
          value={fold}
          onChange={(value) => setFold(value)}
          className="max-w-70 mt-4"
        >
          <Label>Ανάπτυγμα / Σχήμα</Label>
          <SliderOutput/>
          <SliderTrack>
            <SliderFill/>
            <SliderThumb/>
          </SliderTrack>
        </Slider>
        <Separator className="my-4 max-w-70" />
        <div className="max-w-70 mt-4 flex flex-col gap-3">
          <Button className={autoFold ? "bg-(--accent) text-accent-foreground" : ""} onClick={() => setAutoFold(!autoFold)}>
            {autoFold ? (<><IoPauseCircle/><Label>Πάυση Κίνησης</Label></>) : (<><IoPlayCircle/><Label>Ημιτονική κίνηση</Label></>)}
          </Button>
          <Slider
            minValue={0.2}
            maxValue={3}
            step={0.1}
            value={foldSpeed}
            onChange={(value) => setFoldSpeed(value)}
            className={`max-w-70 transition-all ${autoFold ? "opacity-100 pointer-events-auto" : "opacity-40 pointer-events-none"}`}
          >
            <Label>Ταχύτητα</Label>
            <SliderOutput/>
            <SliderTrack>
              <SliderFill/>
              <SliderThumb/>
            </SliderTrack>
          </Slider>
        </div>
        <Separator className="my-4 max-w-70" />
        {dimensionControls.length > 0 && (
          <div className="max-w-70 mt-4 flex flex-col gap-3">
              <Button
                className={showDimensions ? "bg-(--accent) text-accent-foreground mt-0.5" : "mt-0.5"}
                onClick={() => setShowDimensions(!showDimensions)}
              >
                {showDimensions ? (<><Label>Διαστάσεις</Label><IoEyeOff/></>) : (<><Label>Διαστάσεις</Label><IoEye/></>)}
              </Button>
            <Separator className="mb-4 mt-2 max-w-70" />
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-x-4 gap-y-3">
              {dimensionControls.map((control) => (
                <Slider
                  key={control.key}
                  minValue={control.min}
                  maxValue={control.max}
                  step={control.step}
                  value={currentDimensions[control.key]}
                  onChange={(value) => setShapeDimension(shape, control.key, value)}
                  className="min-w-0"
                >
                  <Label>{control.label}</Label>
                  <SliderOutput />
                  <SliderTrack>
                    <SliderFill />
                    <SliderThumb />
                  </SliderTrack>
                </Slider>
              ))}
            </div>
          </div>
        )}
        <div className='flex flex-row absolute bottom-4 right-4 justify-end gap-3 mt-4'>
          <Button className="bg-transparent hover:scale-[1.3] hover:text-(--accent) transition duration-300" onClick={() => setCardVisible(false)}>
            <IoCloseCircle scale={34}/>
          </Button>
        </div>
      </div>
    );
  }
  
  return null; // Fallback so React doesn't complain if spage doesn't match
}

function App() {
  const [radius, setRadius] = useState(5);
  const [segments, setSegments] = useState(12);
  const [cardVisible, setCardVisible] = useState(true);
  const [bottomMode, setBottomMode] = useState(false);
  const [selectedTab, setSelectedTab] = useState("react-aria-1");
  const [isMoved, setIsMoved] = useState(false);
  const [equation, setEquation] = useState("y=x");
  const [playing, setPlaying] = useState(false);

  const [shape, setShape] = useState("cube");
  const [fold, setFold] = useState(0);
  const [showDimensions, setShowDimensions] = useState(false);
  const [autoFold, setAutoFold] = useState(false);
  const [foldSpeed, setFoldSpeed] = useState(1);
  const [shapeDimensions, setShapeDimensions] = useState({});
  const foldPhaseRef = useRef(-Math.PI / 2);

  const handleFoldChange = (value) => {
    const nextFold = clamp01(Number(value));
    setFold(nextFold);
    foldPhaseRef.current = Math.asin(nextFold * 2 - 1);
  };

  const setShapeDimension = (shapeId, key, value) => {
    setShapeDimensions((current) => ({
      ...current,
      [shapeId]: {
        ...(shapeDimensionDefaults[shapeId] ?? {}),
        ...(current[shapeId] ?? {}),
        [key]: Number(value)
      }
    }));
  };

  subscribe("audioStopped", () => setPlaying(false));

  useEffect(() => {
    if (!autoFold) return undefined;

    let frameId;
    let previousTime = performance.now();

    const tick = (now) => {
      const seconds = (now - previousTime) / 1000;
      previousTime = now;
      foldPhaseRef.current = (foldPhaseRef.current + seconds * foldSpeed * Math.PI) % TAU;
      setFold((Math.sin(foldPhaseRef.current) + 1) / 2);
      frameId = requestAnimationFrame(tick);
    };

    frameId = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(frameId);
  }, [autoFold, foldSpeed]);

  const renderContent = () => {
    switch (selectedTab) {
      case "react-aria-1":
        return <CircleAreaDemo r={radius*1.6} s={segments} isMoved={isMoved}/>;
      case "react-aria-2":
        return <MusicEquation className="focus:outline-none" equation={equation} isPlaying={playing}/>;
      case "react-aria-3":
        return <ShapeNets shapeType={shape} foldAmount={fold} showDimensions={showDimensions} dimensions={getShapeDimensions(shape, shapeDimensions)}/>;
      default:
        return null;
    }
  };

  return (
    <div className={`bg-(--background) text-(--foreground) p-8 w-screen h-screen flex flex-col ${bottomMode ? "justify-end" : "justify-start"}`}>
      <div className='flex-grow absolute top-0 left-0 overflow-hidden w-screen h-screen'>
        {renderContent()}
      </div>
      <div className='flex flex-col gap-6 items-start shrink-0'>
        <Card className={`p-4 max-w-200 border-2 border-(--border) transition transition-discrete starting:opacity-0 starting:scale-[0.9] duration-[200ms] ${cardVisible ? "scale-[1] opacity-[1] blur-none flex" : "scale-[0.9] opacity-[0] blur-xs hidden"}`}>
          <Tabs selectedKey={selectedTab} onSelectionChange={(key) => {setSelectedTab(key.toString())}}>
            <Tabs.ListContainer>
              <Tabs.List aria-label="Options">
                <Tab key="react-aria-1">
                  Εμβαδό Κύκλου
                  <Tabs.Indicator />
                </Tab>
                <Tab key="react-aria-2">
                  Μουσικές Συναρτήσεις
                  <Tabs.Indicator />
                </Tab>
                <Tab key="react-aria-3">
                  Αναπτύγματα Στερεών
                  <Tabs.Indicator />
                </Tab>
              </Tabs.List>
            </Tabs.ListContainer>
          </Tabs>
        </Card>

        <Card className={`p-6 max-w-85 border-2 border-(--border) transition transition-discrete starting:opacity-0 starting:scale-[0.9] duration-[200ms] ${cardVisible ? "scale-[1] opacity-[1] blur-none flex" : "scale-[0.9] opacity-[0] blur-xs hidden"}`}>
          {/* 2. Pass the state down so the component can use and modify it */}
          <CurrentModalContent
            spage={selectedTab}
            radius={radius} setRadius={setRadius}
            segments={segments} setSegments={setSegments}
            isMoved={isMoved} setIsMoved={setIsMoved}
            setCardVisible={setCardVisible} equation={equation} setEquation={setEquation}
            playing={playing} setPlaying={setPlaying}
            shape={shape} setShape={setShape}
            fold={fold} setFold={handleFoldChange}
            showDimensions={showDimensions} setShowDimensions={setShowDimensions}
            autoFold={autoFold} setAutoFold={setAutoFold}
            foldSpeed={foldSpeed} setFoldSpeed={setFoldSpeed}
            shapeDimensions={shapeDimensions} setShapeDimension={setShapeDimension}
          />
        </Card>
      </div>
      
      <div className={`opacity-[0] ${!cardVisible ? "scale-[1] blur-none flex" : "scale-[0.9] blur-xs hidden"} fixed top-8 left-8 p-4 hover:opacity-[1] transition`}>
        <Button onClick={() => {setCardVisible(true)}}>
          Εμφάνιση Παραθύρου
        </Button>
      </div>
    </div>
  )
}

export default App
