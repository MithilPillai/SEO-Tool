

import React, { useState } from 'react';
import '../ScrapeBar.css'


export default function ScrapeBar({ updateScrapedData }) {
  const [url, setUrl] = useState("");
  const [loading, setLoading] = useState(false);

  const handleClearClick = () => {
    setUrl("")
    updateScrapedData(null);
  };

  const handleOnChange = (event) => {
    setUrl(event.target.value);
  };

  

  const handleScrapeClick = async () => {
    try {
      setLoading(true);
      // const response = await fetch('http://localhost:3001/scrape', {
      const response = await fetch('https://4bbe-43-252-34-223.ngrok-free.app/scrape', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ url }),
      });


      if (response.ok) {
        const data = await response.json();
        updateScrapedData(data);
      } else {
        console.error('Scrape Failed:', response.statusText);
      }
    } catch (error) {
      console.error('Error during Scrape:', error.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <>
      <div className='d-flex justify-content-center my-3'>
        <input
          className="form-control me-3"

          type="Analyze"
          placeholder="Enter the URL"
          aria-label="Analyze"
          value={url}
          onChange={handleOnChange}
        />
        <button className="btn btn-analyze" onClick={handleScrapeClick} disabled={loading}>
          {loading ? 'Analyzing...' : 'Analyze'}
        </button>
        <button className="btn-clear" onClick={handleClearClick}>Clear</button>

      </div>
      
      
    </>
  );
}


// import React, { useState } from 'react';
// import '../ScrapeBar.css'


// export default function ScrapeBar({ updateScrapedData }) {
//   const [url, setUrl] = useState("");
//   const [loading, setLoading] = useState(false);

//   const handleClearClick = () => {
//     setUrl("")
//     updateScrapedData(null);
//   };

//   const handleOnChange = (event) => {
//     setUrl(event.target.value);
//   };

  


//   const handleScrapeClick = async () => {
//     try {
//       setLoading(true);
//       const encodedUrl = encodeURIComponent(url);
//             const response = await fetch(`http://localhost:3001/scrape?url=${encodedUrl}`, {

//       // const response = await fetch(`https://5b88-43-252-34-223.ngrok-free.app/scrape?url=${encodedUrl}`, {
//         method: 'GET', // Changed to GET
//       });

//       if (response.ok) {
//         const data = await response.json();
//         updateScrapedData(data);
//       } else {
//         console.error('Scrape Failed:', response.statusText);
//       }
//     } catch (error) {
//       console.error('Error during Scrape:', error.message);
//     } finally {
//       setLoading(false);
//     }
//   };


//   return (
//     <>
//       <div className='d-flex justify-content-center my-3'>
//         <input
//           className="form-control me-3"

//           type="Analyze"
//           placeholder="Enter the URL"
//           aria-label="Analyze"
//           value={url}
//           onChange={handleOnChange}
//         />
//         <button className="btn btn-analyze" onClick={handleScrapeClick} disabled={loading}>
//           {loading ? 'Analyzing...' : 'Analyze'}
//         </button>
//         <button className="btn-clear" onClick={handleClearClick}>Clear</button>

//       </div>
      
      
//     </>
//   );
// }