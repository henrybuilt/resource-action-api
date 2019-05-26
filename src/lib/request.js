var request = {
  respond({response, success=true, data={}, errors=[], status=200, error}) {
    if (error) errors.push(error);

    if (errors.length > 0 && status === 200) {
      success = false;
      status = 400;
    }

    if (status !== 200) response.status(status);

    var responseBody = {success, data, errors};

    response.json(responseBody);
  }
};

module.exports = request;
