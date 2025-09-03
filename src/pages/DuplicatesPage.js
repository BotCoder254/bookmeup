import React from 'react';
import { Layout } from '../components/layout';
import { DuplicatesView } from '../components/bookmarks';

const DuplicatesPage = () => {
  return (
    <Layout activeView="duplicates">
      <DuplicatesView />
    </Layout>
  );
};

export default DuplicatesPage;
