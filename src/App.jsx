import { useState } from 'react'
import reactLogo from './assets/react.svg'
import viteLogo from './assets/vite.svg'
import heroImg from './assets/hero.png'
import { Button, Card, Slider, Label, Tabs, Tab, Input } from '@heroui/react'
import { IoArrowForwardCircle, IoCloseCircle, IoArrowUp, IoArrowDown, IoPlayCircle, IoPauseCircle } from "react-icons/io5";
import './App.css'
import './index.css'
import CircleAreaDemo from './components/CircleAreaDemo'
import MusicEquation from './components/MusicEquation'
import { subscribe } from './util/events'

// 1. Accept the state variables and setters as props
function CurrentModalContent({
  spage, 
  radius, setRadius, 
  segments, setSegments, 
  isMoved, setIsMoved, 
  setCardVisible, equation, setEquation, playing, setPlaying
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
          <Slider.Output/>
          <Slider.Track>
            <Slider.Fill/>
            <Slider.Thumb/>
          </Slider.Track>
        </Slider>
        <Slider minValue={2} maxValue={102} step={5} value={segments} onChange={(value) => {setSegments(value)}}>
          <Label>Κομμάτια</Label>
          <Slider.Output/>
          <Slider.Track>
            <Slider.Fill/>
            <Slider.Thumb/>
          </Slider.Track>
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
  subscribe("audioStopped", () => setPlaying(false));
  return (
    <div className={`bg-(--background) p-8 w-screen h-screen ${bottomMode ? "justify-end" : "justify-start"}`}>
      {selectedTab === "react-aria-1" ? (
        <CircleAreaDemo r={radius*1.6} s={segments} isMoved={isMoved}/>
      ) : (
        <MusicEquation className="focus:outline-none" equation={equation} isPlaying={playing}/>
      )}
      <Card className={`p-4 max-w-112 border-2 border-(--border) transition transition-discrete starting:opacity-0 starting:scale-[0.9] duration-[200ms] ${cardVisible ? "scale-[1] opacity-[1] blur-none flex" : "scale-[0.9] opacity-[0] blur-xs hidden"}`}>
        <Tabs selectedKey={selectedTab} onSelectionChange={(key) => {setSelectedTab(key.toString()); console.log(key.toString())}}>
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
            </Tabs.List>
          </Tabs.ListContainer>
        </Tabs>
      </Card>
      
      <Card className={`p-6 mt-6 max-w-85 border-2 border-(--border) transition transition-discrete starting:opacity-0 starting:scale-[0.9] duration-[200ms] ${cardVisible ? "scale-[1] opacity-[1] blur-none flex" : "scale-[0.9] opacity-[0] blur-xs hidden"}`}>
        {/* 2. Pass the state down so the component can use and modify it */}
        <CurrentModalContent 
          spage={selectedTab}
          radius={radius} setRadius={setRadius}
          segments={segments} setSegments={setSegments}
          isMoved={isMoved} setIsMoved={setIsMoved}
          setCardVisible={setCardVisible} equation={equation} setEquation={setEquation}
          playing={playing} setPlaying={setPlaying}
        />
      </Card>
      
      <div className={`opacity-[0] ${!cardVisible ? "scale-[1] blur-none flex" : "scale-[0.9] blur-xs hidden"} p-4 hover:opacity-[1] transition`}>
        <Button onClick={() => {setCardVisible(true)}}>
          Εμφάνιση Παραθύρου
        </Button>
      </div>
    </div>
  )
}

export default App