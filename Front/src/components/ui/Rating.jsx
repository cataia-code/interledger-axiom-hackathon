import Icon from './Icon';
export default function Rating({ value, reviews }) {
  return <span className="rating" aria-label={`${value} de 5${reviews ? `, ${reviews} reseñas` : ''}`}><Icon name="star" />{Number(value).toFixed(1)}{reviews && <small>({reviews})</small>}</span>;
}
