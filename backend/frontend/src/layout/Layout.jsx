import React from 'react';
import Navbar from '../components/Navbar';

const Layout = ({ children, showNav = true }) => (
  <div style={S.wrapper}>
    <div style={S.container}>
      <main style={S.main}>{children}</main>
      {showNav && <Navbar />}
    </div>
  </div>
);

const S = {
  wrapper: {
    display: 'flex',
    justifyContent: 'center',
    background: '#000',
    minHeight: '100vh',
  },
  container: {
    width: '100%',
    maxWidth: '480px',
    background: '#080808',
    minHeight: '100vh',
    display: 'flex',
    flexDirection: 'column',
    position: 'relative',
  },
  main: { flex: 1, overflowY: 'auto', display: 'flex', flexDirection: 'column' },
};

export default Layout;