import api from './auth';

export const createReview = async (data) => {
  try {
    const response = await api.post('/reviews', data);
    return response.data;
  } catch (error) {
    console.error('❌ Erreur création avis:', error);
    throw new Error(
      error.response?.data?.message ||
      'Erreur lors de la création de l\'avis'
    );
  }
};

export const getProductReviews = async (productId, page = 1, limit = 10) => {
  try {
    const response = await api.get(`/reviews/product/${productId}`, {
      params: { page, limit },
    });
    return response.data;
  } catch (error) {
    console.error('❌ Erreur récupération avis:', error);
    throw new Error(
      error.response?.data?.message ||
      'Erreur lors de la récupération des avis'
    );
  }
};

export const markReviewHelpful = async (reviewId) => {
  try {
    const response = await api.post(`/reviews/${reviewId}/helpful`);
    return response.data;
  } catch (error) {
    console.error('❌ Erreur avis utile:', error);
    throw new Error(
      error.response?.data?.message ||
      'Erreur lors du marquage de l\'avis'
    );
  }
};
