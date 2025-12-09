import { memo } from 'react';
import FindContractors from './find-contractors';

// Reuse the unified contractors experience so both routes stay in sync
const ContractorBoard = memo(function ContractorBoard() {
  return <FindContractors />;
});

export default ContractorBoard;