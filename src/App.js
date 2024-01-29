
import React, { useState } from "react";
import Navbar from "./components/Navbar";
import ScrapeBar from "./components/ScrapeBar";
import LinkCard from "./components/LinkCard";
// import './LinkCard.css'

function App() {
  const [scrapedData, setScrapedData] = useState(null);

  // This function will be passed to TextForm so it can update the scraped data
  const updateScrapedData = (data) => {
    setScrapedData(data);
  };

  return (
    <>
      <Navbar title="Chimpzlab" aboutText="About" />
      <div className="container my-3">
        <ScrapeBar updateScrapedData={updateScrapedData} />
        {scrapedData && (
          <div className="cards-container">
            {Object.entries(scrapedData).map(([category, content], index) => (
              <LinkCard key={index} title={category} content={content} />
            ))}
          </div>
        )}
      </div>
    </>
  );
}

export default App;
