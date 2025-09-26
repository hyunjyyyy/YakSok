import React from 'react';
import MapContainer from '../components/map/MapContainer';

const MapPage = () => {
  const pageStyle = {
    width: '100vw', 
    height: '100vh', 
  };

  return (
    <div style={pageStyle}>
      <MapContainer />
    </div>
  );
};

export default MapPage;