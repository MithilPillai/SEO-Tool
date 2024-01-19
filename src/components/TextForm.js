
import React, { useState } from 'react';

export default function TextForm(props) {
  const [url, setUrl] = useState("");
  const [output, setOutput] = useState("");
  const [loading, setLoading] = useState(false);

  const handleClearClick = () => {
    setOutput("");
  }

  const handleOnChange = (event) => {
    setUrl(event.target.value);
  }

  const handleScrapeClick = async () => {
    try {
      // Set loading to true while waiting for the response
      setLoading(true);

      // Make a POST request to your backend with the URL
      const response = await fetch('http://localhost:3001/scrape', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ url }),
      });

      // Check if the request was successful (status code 200)
      if (response.ok) {
        const data = await response.json();
        // Handle the response data from the backend
        console.log('Scrape Successful:', data);
        // Set the output state with the data you want to display
        setOutput(JSON.stringify(data, null, 2)); // Example: Convert data to JSON string with indentation
      } else {
        // Handle errors from the backend
        console.error('Scrape Failed:', response.statusText);
      }
    } catch (error) {
      console.error('Error during Scrape:', error.message);
    } finally {
      // Set loading to false after the request is complete
      setLoading(false);
    }
  };

  return (
    <>
      <div className='d-flex justify-content-center'>
        <form className="d-flex my-3">
          <input
            className="form-control me-2"
            type="search"
            placeholder="Enter the URL"
            aria-label="Search"
            style={{ width: '350px' }}
            value={url}
            onChange={handleOnChange}
          />
          <button className="btn btn-primary" type="button" onClick={handleScrapeClick}>
            Scrape
          </button>
        </form>
      </div>
      <div className='container'>
        <h1>{props.heading} </h1>
        <div className="mb-3">
          <textarea
            className="form-control"
            value={loading ? 'Loading...' : output}
            readOnly
            id="myBox"
            rows="16"
          ></textarea>
        </div>
        <button className="btn btn-primary mx-2" onClick={handleClearClick}> Clear Text </button>
      </div>
      
    </>
  );
}

