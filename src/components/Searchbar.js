
import React from 'react'

export default function Searchbar() {
  return (

<div className='d-flex justify-content-center'>
<form className="d-flex my-3">
            <input
              className="form-control me-2"
              type="search"
              placeholder="Enter the URL"
              aria-label="Search"
              style={{width:'350px'}}
            />
            <button className="btn btn-primary" type="submit">
              Scrape
            </button>
          </form>
</div>
  )
}


