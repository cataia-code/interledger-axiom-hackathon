import Icon from '../ui/Icon';

export default function WalletIllustration() {
  return <div className="wallet-illustration" aria-hidden="true"><span className="wallet-illustration__card wallet-illustration__card--back" /><span className="wallet-illustration__card wallet-illustration__card--front"><i /><i /></span><span className="wallet-illustration__body"><Icon name="wallet" /><span className="wallet-illustration__clasp"><i /></span></span><span className="wallet-illustration__spark">✦</span></div>;
}
