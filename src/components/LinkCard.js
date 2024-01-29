

// import React, { useState } from 'react';
// import '../LinkCard.css'; // Import the CSS file

// const LinkCard = ({ title, content }) => {
//   const [showLinks, setShowLinks] = useState(false);

//   const handleCardClick = () => {
//     setShowLinks(!showLinks);
//   };

//   return (
//     <div className="card-container">
//     <div className={`card ${showLinks ? 'expanded' : ''}`} onClick={handleCardClick}>
//       <div className="card-body">
//         <h5 className="card-title">{title.replace(/([A-Z])/g, ' $1').trim()}</h5>
//         {typeof content === 'object' && (
//           <button
//             type="button"
//             className={`btn btn-sm btn-secondary ${showLinks ? 'up' : 'down'}`}
//             onClick={handleCardClick}
//           >
//             <i className="bi bi-arrow" />
//           </button>
//         )}
//         {typeof content === 'object' ? (
//           <>
//             <p className="card-text">Number of items: {Object.keys(content).length}</p>
//             {showLinks && (
//               <ul>
//                 {Object.entries(content).map(([key, value]) => (
//                   <li key={key}>
//                     <strong>{key}</strong>: {value}
//                   </li>
//                 ))}
//               </ul>
//             )}
//           </>
//         ) : (
//           // If content is a string (e.g., metadata or heading tags)
//           <p className="card-text">{content}</p>
//         )}
//       </div>
//     </div>
//     </div>

//   );
// };

// export default LinkCard;


import React, { useState } from 'react';
import '../LinkCard.css'; // Import the CSS file

const LinkCard = ({ title, content }) => {
  const [showLinks, setShowLinks] = useState(false);

  const handleCardClick = () => {
    setShowLinks(!showLinks);
  };

  return (
    <div className="card-container">
    <div className={`card ${showLinks ? 'expanded' : ''}`} onClick={handleCardClick}>
      <div className="card-body">
        <h5 className="card-title">{title.replace(/([A-Z])/g, ' $1').trim()}</h5>
        {typeof content === 'object' && (
          <button
            type="button"
            className={`btn btn-sm btn-secondary ${showLinks ? 'up' : 'down'}`}
            onClick={handleCardClick}
          >
            <i className="bi bi-arrow" />
          </button>
        )}
        {typeof content === 'object' ? (
          <>
            <p className="card-text">Number of items: {Object.keys(content).length}</p>
            {showLinks && (
              <ul>
                {Object.entries(content).map(([key, value]) => (
                  <li key={key}>
                    <strong>{key}</strong>: {typeof value === 'object' ? JSON.stringify(value) : value.toString()}
                  </li>
                ))}
              </ul>
            )}
          </>
        ) : (
          <p className="card-text">{content}</p>
        )}
      </div>
    </div>
    </div>

  );
};

export default LinkCard;