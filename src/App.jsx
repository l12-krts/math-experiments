import { useState } from 'react'
import reactLogo from './assets/react.svg'
import viteLogo from './assets/vite.svg'
import heroImg from './assets/hero.png'
import { Button, Card, Slider, SliderTrack, SliderFill, SliderThumb, SliderOutput, Label, Tabs, Tab, Input, Select, SelectTrigger, SelectValue, SelectIndicator, SelectPopover, ListBox, ListBoxItem } from '@heroui/react'
import { IoArrowForwardCircle, IoCloseCircle, IoArrowUp, IoArrowDown, IoPlayCircle, IoPauseCircle } from "react-icons/io5";
import './App.css'
import './index.css'
import CircleAreaDemo from './components/CircleAreaDemo'
import MusicEquation from './components/MusicEquation'
import ShapeNets from './components/ShapeNets'
import { subscribe } from './util/events'

// 1. Accept the state variables and setters as props
function CurrentModalContent({
  spage, 
  radius, setRadius, 
  segments, setSegments, 
  isMoved, setIsMoved, 
  setCardVisible, equation, setEquation, playing, setPlaying,
  shape, setShape, fold, setFold
}) {
  const handleInputChange = (e) => {
    // Access the value from the native HTML input element
    setEquation(e.target.value);
  };
  if (spage === "circle-area") {
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
  } else if (spage === "graph-music") {
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
  } else if (spage === "shape-nets") {
    const shapes = [
      "triangular pyramid", "cube", "cuboid", "pentagonal pyramid",
      "cylinder", "triangular prism", "hexagonal prism", "trapezoidal prism",
      "cone", "octahedron", "dodecahedron", "icosahedron"
    ];
    return (
      <>
        <Select
          selectedKey={shape}
          onSelectionChange={(key) => setShape(key)}
        >
          <Label className='mb-1'>Σχήμα</Label>
          <SelectTrigger className='w-full'>
            <SelectValue className='capitalize'/>
            <SelectIndicator />
          </SelectTrigger>
          <SelectPopover>
            <ListBox className='p-1 bg-white rounded-md shadow-lg border border-gray-200 outline-none'>
              {shapes.map((s) => (
                <ListBoxItem key={s} id={s} textValue={s} className='p-2 hover:bg-blue-100 rounded cursor-pointer text-black capitalize outline-none data-[selected]:bg-blue-200'>
                  {s}
                </ListBoxItem>
              ))}
            </ListBox>
          </SelectPopover>
        </Select>
        <Slider
          minValue={0}
          maxValue={1}
          step={0.01}
          value={fold}
          onChange={(value) => setFold(value)}
          className='mt-4'
        >
          <Label>Ανάπτυγμα / Σχήμα</Label>
          <SliderOutput/>
          <SliderTrack>
            <SliderFill/>
            <SliderThumb/>
          </SliderTrack>
        </Slider>
        <div className='flex flex-row justify-end'>
          <Button className="bg-transparent hover:scale-[1.3] hover:text-(--accent) transition duration-[300ms]" onClick={() => setCardVisible(false)}>
            <IoCloseCircle scale={34}/>
          </Button>
        </div>
      </>
    );
  }
  
  return null; // Fallback so React doesn't complain if spage doesn't match
}

function App() {
  const [radius, setRadius] = useState(5);
  const [segments, setSegments] = useState(12);
  const [cardVisible, setCardVisible] = useState(true);
  const [bottomMode, setBottomMode] = useState(false);
  const [selectedTab, setSelectedTab] = useState("circle-area");
  const [isMoved, setIsMoved] = useState(false);
  const [equation, setEquation] = useState("y=x");
  const [playing, setPlaying] = useState(false);

  const [shape, setShape] = useState("cube");
  const [fold, setFold] = useState(0);

  subscribe("audioStopped", () => setPlaying(false));

  const renderContent = () => {
    switch (selectedTab) {
      case "circle-area":
        return <CircleAreaDemo r={radius*1.6} s={segments} isMoved={isMoved}/>;
      case "graph-music":
        return <MusicEquation className="focus:outline-none" equation={equation} isPlaying={playing}/>;
      case "shape-nets":
        return <ShapeNets shapeType={shape} foldAmount={fold}/>;
      default:
        return null;
    }
  };

  return (
    <div className={`bg-(--background) text-(--foreground) p-8 w-screen h-screen flex flex-col ${bottomMode ? "justify-end" : "justify-start"}`}>
      <div className='flex-grow relative overflow-hidden rounded-xl border-2 border-(--border)'>
        {renderContent()}
      </div>
      <div className='flex flex-row gap-6 items-start mt-6 flex-shrink-0'>
        <Card className={`p-4 max-w-150 border-2 border-(--border) transition transition-discrete starting:opacity-0 starting:scale-[0.9] duration-[200ms] ${cardVisible ? "scale-[1] opacity-[1] blur-none flex" : "scale-[0.9] opacity-[0] blur-xs hidden"}`}>
          <Tabs selectedKey={selectedTab} onSelectionChange={(key) => {setSelectedTab(key.toString())}}>
            <Tabs.ListContainer>
              <Tabs.List aria-label="Options">
                <Tab key="circle-area">
                  Εμβαδό Κύκλου
                  <Tabs.Indicator />
                </Tab>
                <Tab key="graph-music">
                  Μουσικές Συναρτήσεις
                  <Tabs.Indicator />
                </Tab>
                <Tab key="shape-nets">
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
            fold={fold} setFold={setFold}
          />
        </Card>
      </div>
      
      <div className={`opacity-[0] ${!cardVisible ? "scale-[1] blur-none flex" : "scale-[0.9] blur-xs hidden"} fixed bottom-8 left-8 p-4 hover:opacity-[1] transition`}>
        <Button onClick={() => {setCardVisible(true)}}>
          Εμφάνιση Παραθύρου
        </Button>
      </div>
    </div>
  )
}

export default App